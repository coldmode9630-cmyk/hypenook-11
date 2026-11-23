/*!
 * HypeNook — shared catalog + pricing rules.
 * This one file is used by the browser (window.HN_STORE) AND by the
 * server functions in /api (require). Prices are always recomputed on
 * the server from this catalog, so a customer cannot change them.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HN_STORE = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BRAND = {
    name: 'HypeNook',
    tagline: 'WEAR YOUR STORY',
    description: 'Clean • Comfortable • Wearable Fashion',
    phoneDisplay: '0336 8807765',
    phoneRaw: '03368807765',
    whatsapp: '923368807765',
    whatsappUrl: 'https://wa.me/923368807765',
    instagram: 'https://www.instagram.com/hypenook.shop/',
    instagramHandle: '@hypenook.shop',
    facebook: 'https://www.facebook.com/profile.php?id=61583966642599',
    email: 'hypenook6@gmail.com'
  };

  // Online payment = direct bank transfer to this account (shown to customers at checkout).
  var BANK = {
    accountTitle: 'MUHAMMAD MUSTAFA HASSAN',
    bank: 'Faysal Bank',
    iban: 'PK51FAYS3620301000001345'
  };
  function formatIBAN(v) { return String(v).replace(/(.{4})/g, '$1 ').trim(); }

  var PRICING = {
    currency: 'Rs.',
    deliveryFee: 299,          // flat, per order, all over Pakistan
    onlineDiscount: 150,       // per order, only for online payment
    maxQtyPerLine: 10
  };

  var SIZES = ['S', 'M', 'L', 'XL'];

  var PRODUCTS = [
    {
      id: 'noir-graphic-oversized-hoodie',
      name: 'NOIR Graphic Oversized Hoodie',
      shortName: 'NOIR Hoodie',
      price: 2750,
      sizes: SIZES,
      isNew: true,
      colour: 'Black',
      tagline: 'Some souls only know to their destruction.',
      description:
        'A heavyweight-look oversized hoodie in deep black. Small chrome NOIR wordmark on the chest; on the back, a full monochrome artwork — a winged statue beneath a full moon, ruined columns and clouds, framed by the NOIR star wordmark and gothic script.',
      details: [
        'Oversized, relaxed fit with dropped shoulders',
        'Drawcord hood with metal-tipped cords',
        'Front kangaroo pocket, ribbed cuffs and hem',
        'NOIR chest print · large back graphic',
        'Unisex — styled on both him and her'
      ],
      // Put your real measurements here (inches) to show them in the size guide.
      // Leave empty and the guide asks customers to message you for exact sizing.
      sizeChart: null, // e.g. { S: { chest: 0, length: 0, sleeve: 0 }, ... }
      images: [
        { key: 'noir-front-2', alt: 'Female model wearing the NOIR hoodie, front view with chest wordmark' },
        { key: 'noir-back-female', alt: 'Female model showing the NOIR angel back graphic' },
        { key: 'noir-back-male', alt: 'Male model showing the NOIR angel back graphic' },
        { key: 'noir-duo', alt: 'Male and female models wearing the NOIR hoodie, back view' }
      ]
    }
  ];

  function getProduct(id) {
    for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i];
    return null;
  }

  function formatPKR(n) {
    var neg = n < 0;
    var s = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + PRICING.currency + ' ' + s;
  }

  /**
   * Sanitise cart lines against the catalog. Unknown products / sizes are dropped,
   * quantities are clamped. Returns lines with authoritative unit prices.
   */
  function normaliseLines(lines) {
    var out = [];
    if (!Array.isArray(lines)) return out;
    lines.forEach(function (l) {
      if (!l || typeof l !== 'object') return;
      var p = getProduct(String(l.id || ''));
      if (!p) return;
      var size = String(l.size || '').toUpperCase();
      if (p.sizes.indexOf(size) === -1) return;
      var qty = parseInt(l.qty, 10);
      if (!(qty >= 1)) return;
      qty = Math.min(qty, PRICING.maxQtyPerLine);
      out.push({ id: p.id, name: p.name, size: size, qty: qty, unitPrice: p.price, lineTotal: p.price * qty });
    });
    return out;
  }

  /**
   * The single source of truth for totals.
   * paymentMethod: 'cod' | 'online'
   *   COD:    subtotal + 299
   *   Online: subtotal + 299 - 150
   */
  function computeTotals(lines, paymentMethod) {
    var items = normaliseLines(lines);
    var subtotal = 0, count = 0;
    items.forEach(function (l) { subtotal += l.lineTotal; count += l.qty; });
    var delivery = items.length ? PRICING.deliveryFee : 0;
    var discount = items.length && paymentMethod === 'online' ? PRICING.onlineDiscount : 0;
    return {
      items: items,
      itemCount: count,
      subtotal: subtotal,
      delivery: delivery,
      discount: discount,
      total: subtotal + delivery - discount,
      paymentMethod: paymentMethod === 'online' ? 'online' : 'cod'
    };
  }

  var PROVINCES = [
    'Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan',
    'Islamabad Capital Territory', 'Gilgit-Baltistan', 'Azad Jammu & Kashmir'
  ];

  /** Normalise a Pakistani mobile number to 03XXXXXXXXX, or return null. */
  function normalisePhone(v) {
    var d = String(v || '').replace(/[\s\-()]/g, '');
    if (/^\+92/.test(d)) d = '0' + d.slice(3);
    else if (/^0092/.test(d)) d = '0' + d.slice(4);
    else if (/^92\d{10}$/.test(d)) d = '0' + d.slice(2);
    return /^03\d{9}$/.test(d) ? d : null;
  }

  /** Validate checkout customer details. Returns { ok, errors, value }. */
  function validateCustomer(c) {
    c = c || {};
    var errors = {};
    var str = function (x, max) { return String(x == null ? '' : x).trim().slice(0, max); };
    var v = {
      name: str(c.name, 80),
      phone: normalisePhone(c.phone),
      email: str(c.email, 120),
      address: str(c.address, 300),
      city: str(c.city, 60),
      province: str(c.province, 60),
      postalCode: str(c.postalCode, 10),
      notes: str(c.notes, 300)
    };
    if (v.name.length < 2) errors.name = 'Please enter your full name.';
    if (!v.phone) errors.phone = 'Enter a valid Pakistani mobile number, e.g. 03XX XXXXXXX.';
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) errors.email = 'That email address doesn’t look right.';
    if (v.address.length < 8) errors.address = 'Please enter your complete delivery address.';
    if (v.city.length < 2) errors.city = 'Please enter your city.';
    if (PROVINCES.indexOf(v.province) === -1) errors.province = 'Please choose your province.';
    if (v.postalCode && !/^\d{5}$/.test(v.postalCode)) errors.postalCode = 'Postal codes in Pakistan have 5 digits.';
    return { ok: Object.keys(errors).length === 0, errors: errors, value: v };
  }

  function makeOrderNumber() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = '';
    for (var i = 0; i < 5; i++) r += chars[Math.floor(Math.random() * chars.length)];
    return 'HN-' + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + '-' + r;
  }

  /** Text for a WhatsApp order / enquiry message. */
  function whatsappOrderText(totals, opts) {
    opts = opts || {};
    var L = [];
    L.push(opts.heading || 'Hi HypeNook! I’d like to order:');
    if (opts.orderNumber) L.push('Order: ' + opts.orderNumber);
    L.push('');
    totals.items.forEach(function (l) {
      L.push('• ' + l.name + ' — Size ' + l.size + ' × ' + l.qty + ' = ' + formatPKR(l.lineTotal));
    });
    L.push('');
    L.push('Subtotal: ' + formatPKR(totals.subtotal));
    L.push('Delivery: ' + formatPKR(totals.delivery));
    if (totals.discount) L.push('Online payment discount: -' + formatPKR(totals.discount));
    L.push('Total: ' + formatPKR(totals.total) + ' (' + (totals.paymentMethod === 'online' ? 'Online payment — bank transfer' : 'Cash on Delivery') + ')');
    if (opts.customer) {
      var c = opts.customer;
      L.push('');
      L.push('Name: ' + c.name);
      L.push('Phone: ' + c.phone);
      L.push('Address: ' + c.address + ', ' + c.city + ', ' + c.province + (c.postalCode ? ' ' + c.postalCode : ''));
      if (c.notes) L.push('Notes: ' + c.notes);
    }
    return L.join('\n');
  }

  function whatsappLink(text) {
    return BRAND.whatsappUrl + (text ? '?text=' + encodeURIComponent(text) : '');
  }

  function bankTransferText(order) {
    return 'Hi HypeNook! I’ve made a bank transfer for my order.\n' +
      'Order: ' + order.orderNumber + '\n' +
      'Amount: ' + formatPKR(order.totals.total) + '\n' +
      'Name: ' + order.customer.name + '\n' +
      'Payment screenshot attached.';
  }

  return {
    BANK: BANK, formatIBAN: formatIBAN, bankTransferText: bankTransferText,
    BRAND: BRAND, PRICING: PRICING, SIZES: SIZES, PRODUCTS: PRODUCTS, PROVINCES: PROVINCES,
    getProduct: getProduct, formatPKR: formatPKR, normaliseLines: normaliseLines,
    computeTotals: computeTotals, normalisePhone: normalisePhone, validateCustomer: validateCustomer,
    makeOrderNumber: makeOrderNumber, whatsappOrderText: whatsappOrderText, whatsappLink: whatsappLink
  };
});
