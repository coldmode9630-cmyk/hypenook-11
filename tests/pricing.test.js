'use strict';
var assert = require('assert');
var S = require('../assets/js/store.js');
var id = 'noir-graphic-oversized-hoodie';

var cod = S.computeTotals([{ id: id, size: 'M', qty: 1 }], 'cod');
assert.deepStrictEqual([cod.subtotal, cod.delivery, cod.discount, cod.total], [2750, 299, 0, 3049], 'COD single item');
var on = S.computeTotals([{ id: id, size: 'M', qty: 1 }], 'online');
assert.deepStrictEqual([on.subtotal, on.delivery, on.discount, on.total], [2750, 299, 150, 2899], 'Online single item');

var two = S.computeTotals([{ id: id, size: 'S', qty: 1 }, { id: id, size: 'XL', qty: 1 }], 'online');
assert.strictEqual(two.total, 5500 + 299 - 150, 'delivery + discount are per order');

// tampering is ignored
var t = S.computeTotals([{ id: id, size: 'M', qty: 1, price: 1 }, { id: 'fake', size: 'M', qty: 1 }, { id: id, size: 'XXL', qty: 1 }, { id: id, size: 'L', qty: -3 }], 'online');
assert.strictEqual(t.items.length, 1); assert.strictEqual(t.total, 2899);
assert.strictEqual(S.computeTotals([{ id: id, size: 'M', qty: 999 }], 'cod').items[0].qty, 10, 'qty clamped');
assert.strictEqual(S.computeTotals([], 'online').total, 0, 'empty cart has no delivery or discount');
assert.strictEqual(S.computeTotals([{ id: id, size: 'M', qty: 1 }], 'bitcoin').discount, 0, 'unknown method = no discount');

assert.strictEqual(S.formatPKR(3049), 'Rs. 3,049');
assert.strictEqual(S.normalisePhone('+92 336 8807765'), '03368807765');
assert.strictEqual(S.normalisePhone('0336-8807765'), '03368807765');
assert.strictEqual(S.normalisePhone('12345'), null);
assert.ok(!S.validateCustomer({}).ok);
assert.ok(S.validateCustomer({ name: 'Ali Khan', phone: '03001234567', address: 'House 1, Street 2, DHA', city: 'Lahore', province: 'Punjab' }).ok);
console.log('pricing tests passed ✓');
