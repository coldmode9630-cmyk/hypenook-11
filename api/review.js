'use strict';
/**
 * POST /api/review — a customer submits a review.
 * Reviews are NEVER published automatically: they are saved in Supabase with
 * status "pending" and only appear on the site after you approve them on
 * /admin.html. If Supabase isn't configured, the review is sent to
 * ORDER_WEBHOOK_URL instead (event "review.submitted"), as before.
 *
 * Spam protection: honeypot field, per-connection rate limit, a per-IP daily
 * limit stored in the database (works across serverless instances), required
 * fields with min/max lengths, no links, and no duplicate reviews.
 */
var STORE = require('../assets/js/store.js');
var http = require('../lib/http.js');
var orders = require('../lib/orders.js');
var db = require('../lib/supabase.js');

var LIMITS = { name: 60, city: 40, title: 80, text: 1000, orderNumber: 30 };
var MAX_PER_IP_PER_DAY = 3;

function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}
function tooLong(v, max) { return typeof v === 'string' && v.trim().length > max; }
var LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|xyz|top|ru|info|biz|io|co|ly|me|shop|site|online)\b)/i;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return http.send(res, 405, { ok: false }); }
  if (http.rateLimited(req, 5, 60 * 60 * 1000)) return http.send(res, 429, { ok: false, message: 'Too many reviews from this connection. Please try again later.' });
  var b;
  try { b = await http.readJson(req); } catch (e) { return http.send(res, 400, { ok: false, message: 'Invalid request.' }); }
  if (!b || typeof b !== 'object') return http.send(res, 400, { ok: false, message: 'Invalid request.' });
  if (b.company) return http.send(res, 200, { ok: true, stored: true }); // honeypot: pretend it worked, store nothing

  var errors = {};
  // Reject over-long input instead of silently cutting it.
  Object.keys(LIMITS).forEach(function (k) { if (tooLong(b[k], LIMITS[k])) errors[k] = 'Please keep this under ' + LIMITS[k] + ' characters.'; });

  var review = {
    productId: clean(b.productId, 80),
    name: clean(b.name, LIMITS.name),
    city: clean(b.city, LIMITS.city),
    rating: Number(b.rating),
    title: clean(b.title, LIMITS.title),
    text: clean(b.text, LIMITS.text),
    size: clean(b.size, 4).toUpperCase(),
    orderNumber: clean(b.orderNumber, LIMITS.orderNumber).toUpperCase(),
    submittedAt: new Date().toISOString(),
    status: 'pending'
  };
  var p = STORE.getProduct(review.productId);
  if (!p) errors.productId = 'Unknown product.';
  if (!errors.name && review.name.length < 2) errors.name = 'Please enter your name.';
  if (!(Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5)) errors.rating = 'Please choose a star rating.';
  if (!errors.text && review.text.length < 10) errors.text = 'Please write at least a few words (10+ characters).';
  if (!errors.text && (LINK.test(review.text) || LINK.test(review.title))) errors.text = 'Please remove links from your review.';
  if (!errors.name && LINK.test(review.name)) errors.name = 'Please enter your name.';
  if (review.size && p && p.sizes.indexOf(review.size) === -1) review.size = '';
  if (Object.keys(errors).length) return http.send(res, 422, { ok: false, message: 'Please check the highlighted fields.', errors: errors });

  // ---- Supabase (permanent storage) ----
  if (db.configured()) {
    try {
      var ip = db.ipHash(req);
      var since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      var recent = await db.rest('GET', 'reviews?select=id&ip_hash=eq.' + ip + '&created_at=gte.' + encodeURIComponent(since) + '&limit=' + (MAX_PER_IP_PER_DAY + 1));
      if (recent && recent.length >= MAX_PER_IP_PER_DAY) {
        return http.send(res, 429, { ok: false, message: 'You’ve already sent a few reviews today. Please try again tomorrow.' });
      }
      var dup = await db.rest('GET', 'reviews?select=id&product_id=eq.' + encodeURIComponent(review.productId) + '&text=eq.' + encodeURIComponent(review.text) + '&limit=1');
      if (dup && dup.length) return http.send(res, 200, { ok: true, stored: true }); // already have it

      await db.rest('POST', 'reviews', {
        product_id: review.productId,
        name: review.name,
        rating: review.rating,
        text: review.text,
        title: review.title || null,
        city: review.city || null,
        size: review.size || null,
        order_number: review.orderNumber || null,
        status: 'pending',
        ip_hash: ip
      }, { Prefer: 'return=minimal' });
      // Optional heads-up to your webhook; never blocks the customer.
      orders.postEvent('review.submitted', review).catch(function () {});
      return http.send(res, 200, { ok: true, stored: true });
    } catch (e) {
      console.error('[review] supabase failed', e);
      return http.send(res, 502, { ok: false, message: 'We couldn’t save your review right now. Please try again or send it on WhatsApp.' });
    }
  }

  // ---- Fallback: webhook (or WhatsApp in the browser if not configured) ----
  try {
    var r = await orders.postEvent('review.submitted', review);
    return http.send(res, 200, { ok: true, stored: r.stored });
  } catch (e) {
    console.error('[review] failed', e);
    return http.send(res, 502, { ok: false, message: 'We couldn’t send your review right now. Please try again or send it on WhatsApp.' });
  }
};
