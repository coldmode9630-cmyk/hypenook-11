'use strict';
/**
 * POST /api/payment/webhook — called by the payment gateway (server-to-server).
 * Verifies the gateway signature, then forwards a "payment.updated" event to
 * ORDER_WEBHOOK_URL. An order is only treated as paid after this verification.
 */
var http = require('../../lib/http.js');
var payments = require('../../lib/payments.js');
var orders = require('../../lib/orders.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return http.send(res, 405, { ok: false }); }
  var raw;
  try { raw = await http.readRaw(req, 64 * 1024, true); } catch (e) { return http.send(res, 400, { ok: false }); }
  var result = null;
  try { result = payments.verifyWebhook(raw, req.headers); } catch (e) { console.error('[webhook] verify error', e); }
  if (!result || !result.orderNumber) return http.send(res, 401, { ok: false, message: 'Invalid signature' });
  try {
    await orders.saveOrder({ orderNumber: result.orderNumber, status: result.paid ? 'paid' : 'payment_failed', payment: result, updatedAt: new Date().toISOString() }, 'payment.updated');
  } catch (e) {
    console.error('[webhook] could not forward', e);
    return http.send(res, 500, { ok: false }); // non-2xx so the gateway retries
  }
  return http.send(res, 200, { ok: true });
};
// Vercel: keep the raw body for signature checks
module.exports.config = { api: { bodyParser: false } };
