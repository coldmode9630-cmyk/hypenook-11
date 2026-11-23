'use strict';
/**
 * Online payment gateway adapter — integration-ready, NOT a fake.
 *
 * Nothing here pretends a payment happened. Until a gateway is configured,
 * isConfigured() is false, the checkout shows "Online payment isn't available
 * yet", and /api/order refuses online orders with HTTP 503.
 *
 * To go live (see README → "Online payments"):
 *   1. Open a merchant account with a Pakistani gateway (e.g. Safepay,
 *      PayFast/APPS, JazzCash, Easypaisa, or a bank's IPG).
 *   2. Set PAYMENT_PROVIDER and the provider's credentials as server env vars.
 *   3. Implement createCheckout() and verifyWebhook() for that provider below,
 *      following the provider's merchant documentation.
 *
 * Contract:
 *   createCheckout(order, ctx) -> { redirectUrl, providerRef }
 *     Create a hosted payment session for order.totals.total (PKR) and return
 *     the URL of the provider's payment page. Use ctx.returnUrl / ctx.cancelUrl
 *     for the customer's return and ctx.webhookUrl for server notifications.
 *   verifyWebhook(rawBody, headers) -> { orderNumber, paid, providerRef, amount } | null
 *     Verify the provider's signature using the secret. Return null if invalid.
 */
var crypto = require('crypto');

var REQUIRED = {
  // Fill in the env var names your provider needs. Example shape:
  safepay: ['PAYMENT_API_KEY', 'PAYMENT_SECRET_KEY', 'PAYMENT_WEBHOOK_SECRET'],
  payfast: ['PAYMENT_MERCHANT_ID', 'PAYMENT_SECURED_KEY', 'PAYMENT_WEBHOOK_SECRET'],
  jazzcash: ['PAYMENT_MERCHANT_ID', 'PAYMENT_PASSWORD', 'PAYMENT_INTEGRITY_SALT'],
  easypaisa: ['PAYMENT_STORE_ID', 'PAYMENT_HASH_KEY', 'PAYMENT_WEBHOOK_SECRET']
};

function provider() { return String(process.env.PAYMENT_PROVIDER || '').toLowerCase(); }

function isConfigured() {
  var p = provider();
  if (!p || !REQUIRED[p]) return false;
  if (!IMPLEMENTED[p]) return false; // provider chosen but its adapter isn't written yet
  if (!process.env.ORDER_WEBHOOK_URL) return false; // never take money for an order we can't store
  return REQUIRED[p].every(function (k) { return !!process.env[k]; });
}

/* ---- Provider implementations go here (server-side only; never in the browser) ---- */
var IMPLEMENTED = {
  // safepay: {
  //   createCheckout: async function (order, ctx) {
  //     // 1. Call the provider's "create payment/session" API with
  //     //    amount = order.totals.total, currency 'PKR', reference = order.orderNumber,
  //     //    using process.env.PAYMENT_SECRET_KEY on the server.
  //     // 2. Return { redirectUrl: <hosted checkout url>, providerRef: <session/tracker id> }.
  //   },
  //   verifyWebhook: function (rawBody, headers) {
  //     // Compute the signature exactly as the provider documents, e.g.:
  //     // var expected = hmac(process.env.PAYMENT_WEBHOOK_SECRET, rawBody);
  //     // if (!safeEqual(expected, headers['x-sfpy-signature'])) return null;
  //     // var data = JSON.parse(rawBody);
  //     // return { orderNumber: data..., paid: data.status === 'PAID', providerRef: data..., amount: data... };
  //   }
  // }
};

async function createCheckout(order, ctx) {
  if (!isConfigured()) throw Object.assign(new Error('Online payment is not configured'), { status: 503, code: 'payment_not_configured' });
  return IMPLEMENTED[provider()].createCheckout(order, ctx);
}

function verifyWebhook(rawBody, headers) {
  if (!isConfigured()) return null;
  return IMPLEMENTED[provider()].verifyWebhook(rawBody, headers);
}

/* Helpers for adapters */
function hmac(secret, data, algo) { return crypto.createHmac(algo || 'sha256', secret).update(data).digest('hex'); }
function safeEqual(a, b) {
  a = Buffer.from(String(a || '')); b = Buffer.from(String(b || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { isConfigured: isConfigured, createCheckout: createCheckout, verifyWebhook: verifyWebhook, provider: provider, hmac: hmac, safeEqual: safeEqual };
