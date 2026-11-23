'use strict';
/**
 * POST /api/order
 * Body: { items: [{ id, size, qty }], customer: {...}, paymentMethod: 'cod' | 'online' }
 *
 * - Re-validates the customer and re-prices every item from the server-side
 *   catalog (assets/js/store.js). Client-sent prices are never trusted.
 * - COD: saves the order (ORDER_WEBHOOK_URL) and returns it.
 * - Online: if a card/wallet gateway is configured, saves the order as
 *   "awaiting_payment" and returns the gateway's payment URL. Otherwise it is a
 *   bank transfer to STORE.BANK: the order is saved as "awaiting_payment" and the
 *   customer is shown the bank details and asked to send the receipt on WhatsApp.
 */
var STORE = require('../assets/js/store.js');
var http = require('../lib/http.js');
var orders = require('../lib/orders.js');
var payments = require('../lib/payments.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return http.send(res, 405, { ok: false, message: 'Method not allowed' }); }
  if (http.rateLimited(req, 10, 10 * 60 * 1000)) return http.send(res, 429, { ok: false, message: 'Too many attempts. Please wait a few minutes or order on WhatsApp.' });

  var body;
  try { body = await http.readJson(req); }
  catch (e) { return http.send(res, e.status || 400, { ok: false, message: 'Invalid request.' }); }

  var pm = body.paymentMethod === 'online' ? 'online' : body.paymentMethod === 'cod' ? 'cod' : null;
  if (!pm) return http.send(res, 422, { ok: false, message: 'Please choose a payment method.' });

  var v = STORE.validateCustomer(body.customer);
  if (!v.ok) return http.send(res, 422, { ok: false, message: 'Please check the highlighted fields.', errors: v.errors });

  var totals = STORE.computeTotals(body.items, pm);
  if (!totals.items.length) return http.send(res, 422, { ok: false, message: 'Your bag is empty or contains items that are no longer available.' });

  // Online payment: a card/wallet gateway if one is configured, otherwise a bank transfer
  // to STORE.BANK. Bank-transfer orders stay "awaiting_payment" until you confirm receipt.
  var useGateway = pm === 'online' && payments.isConfigured();

  var order = {
    orderNumber: STORE.makeOrderNumber(),
    createdAt: new Date().toISOString(),
    status: pm === 'online' ? 'awaiting_payment' : 'received',
    paymentMethod: pm,
    customer: v.value,
    totals: totals
  };

  try {
    if (useGateway) {
      var base = http.siteUrl(req);
      var session = await payments.createCheckout(order, {
        returnUrl: base + '/order.html?order=' + encodeURIComponent(order.orderNumber),
        cancelUrl: base + '/checkout.html',
        webhookUrl: base + '/api/payment/webhook'
      });
      order.payment = { provider: payments.provider(), providerRef: session.providerRef || null };
      var saved = await orders.saveOrder(order, 'order.created');
      if (!saved.stored) console.warn('[order] ORDER_WEBHOOK_URL not set — online order not stored', order.orderNumber);
      return http.send(res, 200, { ok: true, order: order, redirectUrl: session.redirectUrl });
    }

    if (pm === 'online') order.payment = { method: 'bank_transfer', bank: STORE.BANK.bank, iban: STORE.BANK.iban };
    var result = await orders.saveOrder(order, 'order.created');
    if (!result.stored) {
      // Nowhere to store it: tell the browser honestly so the customer sends it on WhatsApp.
      order.status = 'not_sent';
      console.warn('[order] ORDER_WEBHOOK_URL not set — customer asked to confirm on WhatsApp', order.orderNumber);
    }
    console.log('[order]', order.orderNumber, pm, totals.total);
    return http.send(res, 200, { ok: true, order: order });
  } catch (e) {
    console.error('[order] failed', e);
    var status = e.status || 502;
    return http.send(res, status, { ok: false, code: e.code, message: status === 503 ? e.message : 'We couldn’t place your order right now. No payment has been taken. Please try again or order via WhatsApp.' });
  }
};
