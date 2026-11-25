'use strict';
/**
 * Minimal Supabase client (Database REST + Storage) for the /api functions. SERVER ONLY.
 * Uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the environment. The
 * service-role / secret key bypasses Row Level Security, so it must never be
 * sent to the browser. The reviews table and the review-photos bucket have no
 * public access; the browser only ever gets short-lived signed URLs.
 */
var crypto = require('crypto');

var BUCKET = 'review-photos';
var PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
var PHOTO_MAX_BYTES = 5 * 1024 * 1024;
var PHOTO_MAX_COUNT = 3;

function config() {
  var url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  var key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return url && key ? { url: url, key: key } : null;
}
function configured() { return !!config(); }

async function call(base, method, path, body, extraHeaders) {
  var c = config();
  if (!c) throw Object.assign(new Error('Supabase is not configured'), { code: 'not_configured' });
  var headers = { apikey: c.key, 'Content-Type': 'application/json', Accept: 'application/json' };
  // Legacy service_role keys are JWTs and go in Authorization too; new sb_secret_ keys only need `apikey`.
  if (/^eyJ/.test(c.key)) headers.Authorization = 'Bearer ' + c.key;
  Object.keys(extraHeaders || {}).forEach(function (k) { headers[k] = extraHeaders[k]; });
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, 8000);
  try {
    var r = await fetch(c.url + base + path, {
      method: method, headers: headers, signal: ctrl.signal,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    var text = await r.text();
    if (!r.ok) throw Object.assign(new Error('Supabase ' + method + ' ' + base + path.split('?')[0] + ' → ' + r.status + ' ' + text.slice(0, 300)), { status: r.status, body: text });
    return text ? JSON.parse(text) : null;
  } finally { clearTimeout(timer); }
}

/** Database REST call. `path` is relative to /rest/v1/, e.g. "reviews?status=eq.approved". */
function rest(method, path, body, extraHeaders) { return call('/rest/v1/', method, path, body, extraHeaders); }
/** Storage API call. `path` is relative to /storage/v1/. */
function storage(method, path, body) { return call('/storage/v1/', method, path, body); }

/* ---------- review photos (private bucket) ---------- */

/** A signed URL the browser can PUT one file to (valid ~2 hours, single path). */
async function signUpload(path) {
  var r = await storage('POST', 'object/upload/sign/' + BUCKET + '/' + path);
  if (!r || !r.url) throw new Error('No signed upload URL returned');
  return config().url + '/storage/v1' + r.url;
}
/** Files actually stored under "<folder>/" with their real size and type. */
async function listPhotos(folder) {
  var items = await storage('POST', 'object/list/' + BUCKET, { prefix: folder, limit: 20, offset: 0, sortBy: { column: 'name', order: 'asc' } });
  return (items || []).filter(function (it) { return it && it.name && it.id; }).map(function (it) {
    var m = it.metadata || {};
    return { path: folder + '/' + it.name, size: Number(m.size || m.contentLength || 0), type: String(m.mimetype || m.contentType || '') };
  });
}
/** { path: signedDownloadUrl } for the given paths. */
async function signDownloads(paths, expiresIn) {
  var out = {};
  if (!paths.length) return out;
  var r = await storage('POST', 'object/sign/' + BUCKET, { expiresIn: expiresIn || 3600, paths: paths });
  (r || []).forEach(function (it) { if (it && !it.error && it.signedURL) out[it.path] = config().url + '/storage/v1' + it.signedURL; });
  return out;
}
async function removePhotos(paths) {
  if (!paths.length) return;
  await storage('DELETE', 'object/' + BUCKET, { prefixes: paths });
}
/** Attach signed `photos: [url]` to review rows that have photo paths. */
async function withPhotoUrls(rows, expiresIn) {
  var all = [];
  rows.forEach(function (r) { (r.photos || []).forEach(function (p) { all.push(p); }); });
  var urls = {};
  try { urls = await signDownloads(all, expiresIn); } catch (e) { console.error('[supabase] sign photos failed', e.message); }
  return rows.map(function (r) {
    r.photoUrls = (r.photos || []).map(function (p) { return urls[p]; }).filter(Boolean);
    return r;
  });
}

/** True when an error is "column photos does not exist" (SQL for photos not run yet). */
function missingPhotosColumn(e) { return e && e.status === 400 && /photos/.test(e.body || '') && /column/i.test(e.body || ''); }

/** One-way hash of the visitor's IP, used only to rate-limit review submissions. */
function ipHash(req) {
  var ip = String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '').split(',')[0].trim();
  var salt = (process.env.SUPABASE_SERVICE_ROLE_KEY || 'hypenook').slice(-24);
  return crypto.createHash('sha256').update(salt + '|' + ip).digest('hex').slice(0, 40);
}

module.exports = {
  configured: configured, rest: rest, storage: storage, ipHash: ipHash,
  BUCKET: BUCKET, PHOTO_TYPES: PHOTO_TYPES, PHOTO_MAX_BYTES: PHOTO_MAX_BYTES, PHOTO_MAX_COUNT: PHOTO_MAX_COUNT,
  signUpload: signUpload, listPhotos: listPhotos, signDownloads: signDownloads, removePhotos: removePhotos,
  withPhotoUrls: withPhotoUrls, missingPhotosColumn: missingPhotosColumn
};
