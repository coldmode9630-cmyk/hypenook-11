'use strict';
/**
 * Admin API for moderating reviews. Requires header
 *   Authorization: Bearer <ADMIN_PASSWORD>
 *
 * GET  /api/admin/reviews?status=pending|approved   → list reviews
 * POST /api/admin/reviews  { action: "approve" | "delete", id }   (delete also removes its photos)
 */
var crypto = require('crypto');
var http = require('../../lib/http.js');
var db = require('../../lib/supabase.js');

var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var FIELDS = 'id,product_id,name,city,rating,title,text,size,order_number,status,created_at';

/* failed-login throttle (per warm instance) */
var fails = new Map();
function ipOf(req) { return String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || 'x').split(',')[0].trim(); }
function locked(ip) { var f = fails.get(ip); return f && f.n >= 10 && Date.now() - f.t < 15 * 60 * 1000; }
function fail(ip) {
  var f = fails.get(ip); if (!f || Date.now() - f.t > 15 * 60 * 1000) f = { t: Date.now(), n: 0 };
  f.n++; fails.set(ip, f); if (fails.size > 5000) fails.clear();
}
function sameSecret(a, b) {
  var ha = crypto.createHash('sha256').update(String(a)).digest();
  var hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return http.send(res, 405, { ok: false }); }
  var pass = process.env.ADMIN_PASSWORD || '';
  if (!pass) return http.send(res, 503, { ok: false, message: 'ADMIN_PASSWORD is not set on the server.' });
  var ip = ipOf(req);
  if (locked(ip)) return http.send(res, 429, { ok: false, message: 'Too many wrong passwords. Try again in 15 minutes.' });
  var given = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!given || !sameSecret(given, pass)) { fail(ip); return http.send(res, 401, { ok: false, message: 'Wrong password.' }); }
  fails.delete(ip);
  if (!db.configured()) return http.send(res, 503, { ok: false, message: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set on the server.' });

  try {
    if (req.method === 'GET') {
      var status = new URL(req.url, 'http://x').searchParams.get('status') === 'approved' ? 'approved' : 'pending';
      var q = 'reviews?select=' + FIELDS + ',photos&status=eq.' + status + '&order=created_at.desc&limit=500';
      var rows;
      try { rows = (await db.rest('GET', q)) || []; }
      catch (e) { if (!db.missingPhotosColumn(e)) throw e; rows = (await db.rest('GET', q.replace(',photos&', '&'))) || []; }
      rows = await db.withPhotoUrls(rows, 3600);
      return http.send(res, 200, { ok: true, status: status, reviews: rows });
    }
    var b = await http.readJson(req);
    if (!b || !UUID.test(String(b.id || ''))) return http.send(res, 400, { ok: false, message: 'Invalid review id.' });
    if (b.action === 'approve') {
      var up = await db.rest('PATCH', 'reviews?id=eq.' + b.id, { status: 'approved' }, { Prefer: 'return=representation' });
      if (!up || !up.length) return http.send(res, 404, { ok: false, message: 'Review not found.' });
      return http.send(res, 200, { ok: true });
    }
    if (b.action === 'delete') {
      var del = await db.rest('DELETE', 'reviews?id=eq.' + b.id, undefined, { Prefer: 'return=representation' });
      if (!del || !del.length) return http.send(res, 404, { ok: false, message: 'Review not found.' });
      // Remove its photos too: the saved paths plus anything else left in its folder.
      try {
        var paths = (del[0].photos || []).slice();
        (await db.listPhotos(b.id)).forEach(function (f) { if (paths.indexOf(f.path) === -1) paths.push(f.path); });
        await db.removePhotos(paths);
      } catch (e) { console.error('[admin/reviews] photo cleanup failed', e.message); }
      return http.send(res, 200, { ok: true });
    }
    return http.send(res, 400, { ok: false, message: 'Unknown action.' });
  } catch (e) {
    console.error('[admin/reviews] failed', e);
    return http.send(res, e.status === 400 ? 400 : 502, { ok: false, message: 'Database error. Check the server logs.' });
  }
};
