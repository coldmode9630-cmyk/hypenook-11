'use strict';
/**
 * GET /api/reviews[?productId=...] — public list of APPROVED reviews only.
 * Pending reviews and private fields (IP hash, order number) are never returned.
 * Photos of approved reviews come back as signed links (valid 6 hours).
 * Cached at the edge for 60 s, so a newly approved review shows within a minute.
 */
var http = require('../lib/http.js');
var db = require('../lib/supabase.js');

var FIELDS = 'id,product_id,name,city,rating,title,text,size,created_at';
var PHOTO_URL_TTL = 6 * 60 * 60;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return http.send(res, 405, { ok: false }); }
  if (!db.configured()) return http.send(res, 200, { ok: true, configured: false, reviews: [] });

  var url = new URL(req.url, 'http://x');
  var productId = String(url.searchParams.get('productId') || '').slice(0, 80);
  var q = 'reviews?select=' + FIELDS + ',photos&status=eq.approved&order=created_at.desc&limit=500' +
    (productId ? '&product_id=eq.' + encodeURIComponent(productId) : '');
  try {
    var rows;
    try { rows = (await db.rest('GET', q)) || []; }
    catch (e) { if (!db.missingPhotosColumn(e)) throw e; rows = (await db.rest('GET', q.replace(',photos&', '&'))) || []; }
    rows = await db.withPhotoUrls(rows, PHOTO_URL_TTL);
    var reviews = rows.map(function (r) {
      return { id: r.id, productId: r.product_id, name: r.name, city: r.city || '', rating: r.rating,
        title: r.title || '', text: r.text, size: r.size || '', date: r.created_at, photos: r.photoUrls || [] };
    });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.end(JSON.stringify({ ok: true, configured: true, reviews: reviews }));
  } catch (e) {
    console.error('[reviews] supabase failed', e);
    return http.send(res, 502, { ok: false, reviews: [] });
  }
};
