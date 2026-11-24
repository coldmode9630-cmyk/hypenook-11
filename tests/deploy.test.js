'use strict';
/**
 * Deployment checks for Vercel (static site + /api serverless functions).
 * Run: node tests/deploy.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var http = require('http');
var ROOT = path.resolve(__dirname, '..');
var ok = function (m) { console.log('  ✓ ' + m); };

// 1. Nothing Vercel would mistake for a whole-app Node server entrypoint
var ENTRY = /^(server|app|index)\.(js|cjs|mjs|ts|cts|mts)$/;
['', 'src'].forEach(function (dir) {
  var d = path.join(ROOT, dir);
  if (!fs.existsSync(d)) return;
  fs.readdirSync(d).forEach(function (f) { assert.ok(!ENTRY.test(f), 'Found server entrypoint candidate: ' + path.join(dir, f)); });
});
ok('no server.* / app.* / index.* script at the project root or in src/');

// 2. vercel.json pins the "Other" (no framework) preset and keeps the functions config
var vc = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
assert.strictEqual(vc.framework, null, 'vercel.json must set "framework": null');
assert.ok(vc.functions && vc.functions['api/**/*.js'], 'functions config for api/**/*.js');
assert.ok(!vc.builds && !vc.rewrites, 'no legacy builds/rewrites that would route pages to a function');
ok('vercel.json: framework null, api functions configured, no builds/rewrites');

// 3. Every local file referenced by the HTML pages exists
var html = fs.readdirSync(ROOT).filter(function (f) { return /\.html$/.test(f); });
var missing = [];
html.forEach(function (f) {
  var s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  var re = /(src|href|srcset)="([^"]+)"/g, m;
  while ((m = re.exec(s))) {
    (m[1] === 'srcset' ? m[2].split(',') : [m[2]]).forEach(function (part) {
      var u = part.trim().split(/\s+/)[0].split(/[?#]/)[0];
      if (!u || /^(https?:|mailto:|tel:|data:|#)/.test(u)) return;
      if (!fs.existsSync(path.join(ROOT, u))) missing.push(f + ' → ' + u);
    });
  }
});
assert.deepStrictEqual(missing, [], 'Missing files: ' + missing.join(', '));
ok(html.length + ' HTML pages: every script, stylesheet and image path exists');

// 4. Browser scripts are loaded only by HTML, never required by server code
var serverFiles = [];
(function walk(d) {
  fs.readdirSync(d).forEach(function (f) {
    var p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p); else if (/\.js$/.test(f)) serverFiles.push(p);
  });
})(path.join(ROOT, 'api'));
serverFiles = serverFiles.concat(fs.readdirSync(path.join(ROOT, 'lib')).map(function (f) { return path.join(ROOT, 'lib', f); }));
serverFiles.forEach(function (f) {
  var s = fs.readFileSync(f, 'utf8');
  (s.match(/require\(['"]([^'"]+)['"]\)/g) || []).forEach(function (r) {
    var target = r.replace(/require\(['"]|['"]\)/g, '');
    if (target.charAt(0) !== '.') return;
    var rel = path.relative(ROOT, path.resolve(path.dirname(f), target));
    assert.ok(!/^assets\/js\//.test(rel) || rel === 'assets/js/store.js', path.relative(ROOT, f) + ' requires browser file ' + rel);
  });
});
ok('server code only requires the shared, browser-safe assets/js/store.js');

// 5. Each /api file is a Node (req, res) handler that runs without any browser globals
var routes = {};
serverFiles.filter(function (f) { return f.indexOf(path.join(ROOT, 'api')) === 0; }).forEach(function (f) {
  var mod = require(f);
  assert.strictEqual(typeof mod, 'function', path.relative(ROOT, f) + ' must export a handler');
  routes['/' + path.relative(ROOT, f).split(path.sep).join('/').replace(/\.js$/, '')] = mod;
});
assert.strictEqual(typeof global.window, 'undefined');
ok(Object.keys(routes).length + ' API functions load in plain Node: ' + Object.keys(routes).join(', '));

// 6. Invoke them the way Vercel's Node runtime does (one handler per route, raw req/res)
var server = http.createServer(function (req, res) {
  var h = routes[new URL(req.url, 'http://x').pathname];
  if (!h) { res.statusCode = 404; return res.end(); }
  Promise.resolve(h(req, res)).catch(function (e) { res.statusCode = 500; res.end(String(e)); });
}).listen(0, async function () {
  var base = 'http://127.0.0.1:' + server.address().port;
  var post = function (p, body) { return fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); };
  var customer = { name: 'Test Buyer', phone: '03001234567', address: 'House 1, Street 2, DHA', city: 'Lahore', province: 'Punjab' };
  try {
    var r = await fetch(base + '/api/payment/status'); assert.strictEqual(r.status, 200);
    r = await post('/api/order', { items: [{ id: 'noir-graphic-oversized-hoodie', size: 'M', qty: 1 }], customer: customer, paymentMethod: 'cod' });
    var d = await r.json(); assert.strictEqual(r.status, 200); assert.strictEqual(d.order.totals.total, 3049);
    r = await post('/api/order', { items: [{ id: 'noir-graphic-oversized-hoodie', size: 'M', qty: 1 }], customer: customer, paymentMethod: 'online' });
    d = await r.json(); assert.strictEqual(r.status, 200); assert.strictEqual(d.order.totals.total, 2899); assert.strictEqual(d.order.payment.method, 'bank_transfer');
    r = await post('/api/review', { productId: 'noir-graphic-oversized-hoodie', rating: 5, name: 'Test', text: 'Testing the review endpoint.' });
    assert.strictEqual(r.status, 200);
    r = await post('/api/payment/webhook', {}); assert.strictEqual(r.status, 401);
    r = await fetch(base + '/api/reviews'); d = await r.json(); assert.strictEqual(r.status, 200); assert.ok(Array.isArray(d.reviews));
    r = await fetch(base + '/api/admin/reviews', { headers: { Authorization: 'Bearer wrong' } }); assert.ok(r.status === 401 || r.status === 503, 'admin must reject, got ' + r.status);
    r = await post('/api/review', { productId: 'noir-graphic-oversized-hoodie', rating: 5, name: 'Spam', text: 'Great deals at www.spam-site.com now' }); assert.strictEqual(r.status, 422);
    r = await post('/api/review', { productId: 'noir-graphic-oversized-hoodie', rating: 5, name: 'Test', text: 'x'.repeat(1001) }); assert.strictEqual(r.status, 422);
    ok('API handlers respond correctly (COD Rs. 3,049 · online Rs. 2,899 · review + spam checks · approved reviews · admin auth · webhook signature check)');
    console.log('deploy tests passed ✓');
  } catch (e) { console.error(e); process.exitCode = 1; }
  server.close();
});
