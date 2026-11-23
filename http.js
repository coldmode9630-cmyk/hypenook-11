'use strict';
/** Small helpers shared by the /api functions (no dependencies). */

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(data));
}

/** Read the raw request body (max ~32 KB). Works on Vercel and the local server. */
function readRaw(req, limit, streamOnly) {
  limit = limit || 32 * 1024;
  if (!streamOnly && typeof req.body === 'string') return Promise.resolve(req.body);
  if (!streamOnly && req.body && Buffer.isBuffer(req.body)) return Promise.resolve(req.body.toString('utf8'));
  if (!streamOnly && req.body && typeof req.body === 'object') return Promise.resolve(JSON.stringify(req.body));
  return new Promise(function (resolve, reject) {
    var size = 0, chunks = [];
    req.on('data', function (c) {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('Payload too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', function () { resolve(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', reject);
  });
}

async function readJson(req) {
  var raw = await readRaw(req);
  try { return JSON.parse(raw || '{}'); }
  catch (e) { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}

/* Best-effort in-memory rate limit (per warm instance). Use your host's
   firewall / WAF for real protection against abuse. */
var hits = new Map();
function rateLimited(req, max, windowMs) {
  var ip = String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || 'x').split(',')[0].trim();
  var now = Date.now(), rec = hits.get(ip);
  if (!rec || now - rec.t > windowMs) rec = { t: now, n: 0 };
  rec.n++; hits.set(ip, rec);
  if (hits.size > 5000) hits.clear();
  return rec.n > max;
}

function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  var proto = req.headers['x-forwarded-proto'] || 'https';
  return proto + '://' + req.headers.host;
}

module.exports = { send: send, readRaw: readRaw, readJson: readJson, rateLimited: rateLimited, siteUrl: siteUrl };
