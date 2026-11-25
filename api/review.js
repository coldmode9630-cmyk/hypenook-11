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
var crypto = require('crypto');
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (b.action === 'photos') return confirmPhotos(b, res);
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
  // Photos: the browser only sends type + size here; the files go straight to storage afterwards.
  var photos = Array.isArray(b.photos) ? b.photos : [];
  if (photos.length > db.PHOTO_MAX_COUNT) errors.photos = 'You can add up to ' + db.PHOTO_MAX_COUNT + ' photos.';
  else if (photos.some(function (f) { return !f || !db.PHOTO_TYPES[f.type] || !(Number(f.size) > 0 && Number(f.size) <= db.PHOTO_MAX_BYTES); })) {
    errors.photos = 'Photos must be JPG, PNG or WEBP and under 5 MB each.';
  }
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

      var created = await db.rest('POST', 'reviews?select=id', {
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
      }, { Prefer: 'return=representation' });
      var id = created && created[0] && created[0].id;
      // Optional heads-up to your webhook; never blocks the customer.
      orders.postEvent('review.submitted', review).catch(function () {});

      // Signed upload URLs only exist for a review that was just saved.
      var uploads = [];
      if (id && photos.length) {
        try {
          for (var i = 0; i < photos.length; i++) {
            var path = id + '/' + (i + 1) + '-' + crypto.randomBytes(6).toString('hex') + '.' + db.PHOTO_TYPES[photos[i].type];
            uploads.push({ path: path, url: await db.signUpload(path) });
          }
        } catch (e) { console.error('[review] could not sign photo uploads', e); uploads = []; }
      }
      return http.send(res, 200, { ok: true, stored: true, id: id, uploads: uploads, photosSupported: true });
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

/**
 * POST /api/review { action: "photos", id } — called by the browser after it has
 * uploaded the photos with the signed URLs. The server looks at what was really
 * stored, keeps at most 3 valid images (JPG/PNG/WEBP, ≤ 5 MB), deletes anything
 * else and saves the paths on the review. Works once, on a fresh pending review.
 */
async function confirmPhotos(b, res) {
  if (!db.configured()) return http.send(res, 503, { ok: false });
  var id = String(b.id || '');
  if (!UUID.test(id)) return http.send(res, 400, { ok: false, message: 'Invalid review id.' });
  try {
    var rows = await db.rest('GET', 'reviews?select=id,status,created_at,photos&id=eq.' + id);
    var r = rows && rows[0];
    if (!r) return http.send(res, 404, { ok: false, message: 'Review not found.' });
    var fresh = Date.now() - new Date(r.created_at).getTime() < 2 * 60 * 60 * 1000;
    if (r.status !== 'pending' || !fresh || (r.photos && r.photos.length)) return http.send(res, 409, { ok: false, message: 'Photos can no longer be added to this review.' });

    var files = await db.listPhotos(id);
    var keep = [], drop = [];
    files.forEach(function (f) {
      var valid = db.PHOTO_TYPES[f.type] && f.size > 0 && f.size <= db.PHOTO_MAX_BYTES;
      if (valid && keep.length < db.PHOTO_MAX_COUNT) keep.push(f.path); else drop.push(f.path);
    });
    if (drop.length) await db.removePhotos(drop);
    if (keep.length) await db.rest('PATCH', 'reviews?id=eq.' + id, { photos: keep }, { Prefer: 'return=minimal' });
    return http.send(res, 200, { ok: true, photos: keep.length, rejected: drop.length });
  } catch (e) {
    console.error('[review] confirm photos failed', e);
    return http.send(res, 502, { ok: false, message: 'We couldn’t attach your photos. Your review was still sent.' });
  }
}
