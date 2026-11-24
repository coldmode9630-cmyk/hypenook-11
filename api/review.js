'use strict';
/**
 * POST /api/review — a customer submits a review.
 * Reviews are NEVER published automatically. They are sent to ORDER_WEBHOOK_URL
 * as event "review.submitted" (status "pending") for you to check; approved
 * reviews are added by hand to assets/data/reviews.json.
 */
var STORE = require('../assets/js/store.js');
var http = require('../lib/http.js');
var orders = require('../lib/orders.js');

function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return http.send(res, 405, { ok: false }); }
  if (http.rateLimited(req, 5, 60 * 60 * 1000)) return http.send(res, 429, { ok: false, message: 'Too many reviews from this connection. Please try again later.' });
  var b;
  try { b = await http.readJson(req); } catch (e) { return http.send(res, 400, { ok: false, message: 'Invalid request.' }); }
  if (b.company) return http.send(res, 200, { ok: true, stored: false }); // honeypot

  var review = {
    id: 'R-' + Date.now().toString(36).toUpperCase(),
    productId: clean(b.productId, 80),
    name: clean(b.name, 60),
    city: clean(b.city, 40),
    rating: parseInt(b.rating, 10),
    title: clean(b.title, 80),
    text: clean(b.text, 1000),
    size: clean(b.size, 4).toUpperCase(),
    orderNumber: clean(b.orderNumber, 30).toUpperCase(),
    submittedAt: new Date().toISOString(),
    status: 'pending'
  };
  var errors = {};
  var p = STORE.getProduct(review.productId);
  if (!p) errors.productId = 'Unknown product.';
  if (review.name.length < 2) errors.name = 'Please enter your name.';
  if (!(review.rating >= 1 && review.rating <= 5)) errors.rating = 'Please choose a star rating.';
  if (review.text.length < 10) errors.text = 'Please write at least a few words (10+ characters).';
  if (review.size && p && p.sizes.indexOf(review.size) === -1) review.size = '';
  if (Object.keys(errors).length) return http.send(res, 422, { ok: false, message: 'Please check the highlighted fields.', errors: errors });

  try {
    var r = await orders.postEvent('review.submitted', review);
    return http.send(res, 200, { ok: true, stored: r.stored });
  } catch (e) {
    console.error('[review] failed', e);
    return http.send(res, 502, { ok: false, message: 'We couldn’t send your review right now. Please try again or send it on WhatsApp.' });
  }
};
