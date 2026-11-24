'use strict';
/**
 * Minimal Supabase (PostgREST) client for the /api functions. SERVER ONLY.
 * Uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the environment. The
 * service-role / secret key bypasses Row Level Security, so it must never be
 * sent to the browser. The reviews table has RLS on and no public policies.
 */
var crypto = require('crypto');

function config() {
  var url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  var key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return url && key ? { url: url, key: key } : null;
}
function configured() { return !!config(); }

/**
 * Call the REST API. `path` is relative to /rest/v1/, e.g. "reviews?status=eq.approved".
 * Returns parsed JSON (or null for empty bodies). Throws on non-2xx.
 */
async function rest(method, path, body, extraHeaders) {
  var c = config();
  if (!c) throw Object.assign(new Error('Supabase is not configured'), { code: 'not_configured' });
  var headers = { apikey: c.key, 'Content-Type': 'application/json', Accept: 'application/json' };
  // Legacy service_role keys are JWTs and go in Authorization too; new sb_secret_ keys only need `apikey`.
  if (/^eyJ/.test(c.key)) headers.Authorization = 'Bearer ' + c.key;
  Object.keys(extraHeaders || {}).forEach(function (k) { headers[k] = extraHeaders[k]; });
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, 8000);
  try {
    var r = await fetch(c.url + '/rest/v1/' + path, {
      method: method, headers: headers, signal: ctrl.signal,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    var text = await r.text();
    if (!r.ok) throw Object.assign(new Error('Supabase ' + method + ' ' + path.split('?')[0] + ' → ' + r.status + ' ' + text.slice(0, 300)), { status: r.status });
    return text ? JSON.parse(text) : null;
  } finally { clearTimeout(timer); }
}

/** One-way hash of the visitor's IP, used only to rate-limit review submissions. */
function ipHash(req) {
  var ip = String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '').split(',')[0].trim();
  var salt = (process.env.SUPABASE_SERVICE_ROLE_KEY || 'hypenook').slice(-24);
  return crypto.createHash('sha256').update(salt + '|' + ip).digest('hex').slice(0, 40);
}

module.exports = { configured: configured, rest: rest, ipHash: ipHash };
