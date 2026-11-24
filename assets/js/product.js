/* HypeNook — product detail page */
(function () {
  'use strict';
  var S = window.HN_STORE, H = window.HN;
  var id = new URLSearchParams(location.search).get('id') || 'noir-graphic-oversized-hoodie';
  var p = S.getProduct(id);
  var root = H.$('#pdp');
  if (!p) {
    root.innerHTML = '<div style="padding:120px 0"><h1 class="display h-md">Product not found</h1><p class="lede" style="margin:20px 0 30px">This product doesn’t exist or is no longer available.</p><a class="btn" href="shop.html"><span class="btn__label">Back to shop</span></a></div>';
    H.$('#lookTitle').closest('section').remove();
    return;
  }
  document.title = p.name + ' — ' + S.formatPKR(p.price) + ' | HypeNook';

  var state = { img: 0, size: null, qty: 1 };
  var onlineTotal = S.computeTotals([{ id: p.id, size: p.sizes[0], qty: 1 }], 'online').total;
  var codTotal = S.computeTotals([{ id: p.id, size: p.sizes[0], qty: 1 }], 'cod').total;

  root.innerHTML =
    '<div class="gallery">' +
      '<div class="thumbs" role="tablist" aria-label="Product images">' + p.images.map(function (im, i) {
        return '<button type="button" role="tab" aria-label="Image ' + (i + 1) + ': ' + H.esc(im.alt) + '" aria-current="' + (i === 0) + '" data-i="' + i + '"><img src="' + H.img(im.key, true) + '" alt="" width="84" height="92" loading="lazy"></button>';
      }).join('') + '</div>' +
      '<div class="stage" id="stage" tabindex="0" aria-label="Product image. Click or press Enter to zoom; use arrow keys to change image." role="img">' +
        '<img class="stage__img is-current" src="' + H.img(p.images[0].key) + '" alt="' + H.esc(p.images[0].alt) + '" width="1200" height="1490" fetchpriority="high">' +
        '<span class="stage__index" id="stageIndex">01 / 0' + p.images.length + '</span>' +
        '<span class="stage__hint">Click to zoom</span>' +
        '<div class="stage__nav"><button type="button" id="prevImg" aria-label="Previous image"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M15 5l-7 7 7 7"/></svg></button><button type="button" id="nextImg" aria-label="Next image"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 5l7 7-7 7"/></svg></button></div>' +
      '</div>' +
    '</div>' +
    '<div class="buybox">' +
      '<nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><a href="shop.html">Shop</a><span>/</span><span>' + H.esc(p.shortName) + '</span></nav>' +
      (p.isNew ? '<span class="card__badge" style="position:static;display:inline-block">New drop</span>' : '') +
      '<h1 class="display" data-split data-hero>' + H.esc(p.name).replace('Graphic ', 'Graphic<br>') + '</h1>' +
      '<div class="buybox__price"><span>' + S.formatPKR(p.price) + '</span><small>Rs. 150 off when you pay online</small></div>' +
      '<div id="ratingBadge" class="rv-badge-wrap"></div>' +
      '<p class="buybox__tag">“' + H.esc(p.tagline) + '”</p>' +
      '<div class="opt"><div class="opt__label"><span>Size <span id="sizeChosen" style="color:var(--muted)"></span></span><button type="button" id="sizeGuideBtn">Size guide</button></div>' +
        '<div class="sizes" id="sizes" role="radiogroup" aria-label="Select size" aria-describedby="sizeErr">' + p.sizes.map(function (s, i) {
          return '<button type="button" class="size" role="radio" aria-checked="false" tabindex="' + (i === 0 ? 0 : -1) + '" data-size="' + s + '">' + s + '</button>';
        }).join('') + '</div><p class="field-error" id="sizeErr" role="alert"></p></div>' +
      '<div class="opt" style="margin-top:18px"><div class="opt__label"><span>Quantity</span></div>' +
        '<div class="qty qty--lg" role="group" aria-label="Quantity"><button type="button" id="qtyDec" aria-label="Decrease quantity">−</button><output id="qtyVal" aria-live="polite">1</output><button type="button" id="qtyInc" aria-label="Increase quantity">+</button></div></div>' +
      '<div class="buy-stack" style="margin-top:26px">' +
        '<button class="btn btn--block" type="button" id="addBtn"><span class="btn__label">Add to bag — <span id="addPrice">' + S.formatPKR(p.price) + '</span></span></button>' +
        '<button class="btn btn--green btn--block" type="button" id="buyBtn"><span class="btn__label">Buy now</span></button>' +
      '</div>' +
      '<a class="wa-link" id="waLink" href="#" target="_blank" rel="noopener">' + H.ICON.wa + '<span>Order or ask on WhatsApp</span></a>' +
      '<div class="acc">' +
        '<details open><summary>Description</summary><div class="acc__body"><p style="margin-top:0">' + H.esc(p.description) + '</p><ul>' + p.details.map(function (d) { return '<li>' + H.esc(d) + '</li>'; }).join('') + '</ul></div></details>' +
        '<details><summary>Size guide</summary><div class="acc__body" id="sizeGuideInline"></div></details>' +
        '<details><summary>Shipping &amp; payment</summary><div class="acc__body"><p style="margin-top:0">Delivery all over Pakistan 🇵🇰 — ' + S.formatPKR(S.PRICING.deliveryFee) + ' per order.</p>' +
          '<table class="pdp-price-table"><tbody>' +
          '<tr><td>Cash on Delivery (1 item)</td><td>' + S.formatPKR(p.price) + ' + ' + S.formatPKR(S.PRICING.deliveryFee) + ' = ' + S.formatPKR(codTotal) + '</td></tr>' +
          '<tr><td>Online payment (1 item)</td><td>' + S.formatPKR(p.price) + ' + ' + S.formatPKR(S.PRICING.deliveryFee) + ' − ' + S.formatPKR(S.PRICING.onlineDiscount) + ' = ' + S.formatPKR(onlineTotal) + '</td></tr>' +
          '</tbody></table></div></details>' +
        '<details><summary>Returns &amp; exchange</summary><div class="acc__body"><p style="margin-top:0">Need a different size? See our <a class="link-u" href="returns.html" style="color:var(--off)">Return &amp; Exchange Policy</a> or message us on WhatsApp.</p></div></details>' +
      '</div>' +
    '</div>';

  // size guide content (from catalog; no invented measurements)
  var guide;
  if (p.sizeChart) {
    guide = '<table class="table"><thead><tr><th>Size</th><th>Chest (in)</th><th>Length (in)</th><th>Sleeve (in)</th></tr></thead><tbody>' +
      p.sizes.map(function (s) { var r = p.sizeChart[s] || {}; return '<tr><td>' + s + '</td><td>' + (r.chest || '—') + '</td><td>' + (r.length || '—') + '</td><td>' + (r.sleeve || '—') + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<p style="color:var(--muted);font-size:13px;margin-top:14px">Measurements are of the garment laid flat.</p>';
  } else {
    guide = '<table class="table"><thead><tr><th>Size</th><th>Fit</th></tr></thead><tbody>' +
      '<tr><td>S</td><td>Oversized, relaxed</td></tr><tr><td>M</td><td>Oversized, relaxed</td></tr><tr><td>L</td><td>Oversized, relaxed</td></tr><tr><td>XL</td><td>Oversized, relaxed</td></tr></tbody></table>';
  }
  guide += '<p style="margin-top:16px">This hoodie is cut oversized with dropped shoulders. For the intended relaxed look, take your usual size; size down for a closer fit.</p>' +
    '<p>Want exact measurements for your size? <a class="link-u" style="color:var(--off)" target="_blank" rel="noopener" href="' + S.whatsappLink('Hi HypeNook! Could you share the measurements for the ' + p.name + '?') + '">Ask us on WhatsApp</a>.</p>';
  H.$('#sizeGuideBody').innerHTML = guide;
  H.$('#sizeGuideInline').innerHTML = guide;
  H.$('#sizeGuideBtn').addEventListener('click', function () { H.openModal('sizeModal'); });

  /* ---- gallery with clip-path transition + zoom ---- */
  var stage = H.$('#stage'), busy = false;
  function show(i) {
    i = (i + p.images.length) % p.images.length;
    if (i === state.img || busy) return;
    var dir = i > state.img ? 1 : -1;
    state.img = i; stage.classList.remove('is-zoom');
    H.$$('.thumbs button').forEach(function (b, j) { b.setAttribute('aria-current', String(j === i)); });
    H.$('#stageIndex').textContent = '0' + (i + 1) + ' / 0' + p.images.length;
    var old = H.$('.stage__img.is-current', stage);
    var n = H.el('img', { class: 'stage__img', src: H.img(p.images[i].key), alt: p.images[i].alt, width: 1200, height: 1490 });
    if (H.reduceMotion) { old.replaceWith(n); n.classList.add('is-current'); return; }
    busy = true;
    n.style.clipPath = dir > 0 ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)';
    n.style.transform = 'scale(1.08)';
    old.after(n);
    var go = function () {
      requestAnimationFrame(function () { n.style.clipPath = 'inset(0 0 0 0)'; n.style.transform = 'scale(1)'; });
      setTimeout(function () { old.remove(); n.classList.add('is-current'); n.style.clipPath = ''; n.style.transform = ''; busy = false; }, 1050);
    };
    if (n.complete) go(); else { n.onload = go; n.onerror = go; }
  }
  H.$('.thumbs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) show(+b.getAttribute('data-i')); });
  H.$('#prevImg').addEventListener('click', function (e) { e.stopPropagation(); show(state.img - 1); });
  H.$('#nextImg').addEventListener('click', function (e) { e.stopPropagation(); show(state.img + 1); });
  function zoomAt(x, y) {
    var cur = H.$('.stage__img.is-current', stage), r = stage.getBoundingClientRect();
    cur.style.transformOrigin = ((x - r.left) / r.width * 100) + '% ' + ((y - r.top) / r.height * 100) + '%';
  }
  stage.addEventListener('click', function (e) {
    if (e.target.closest('.stage__nav') || busy) return;
    stage.classList.toggle('is-zoom'); zoomAt(e.clientX, e.clientY);
  });
  stage.addEventListener('mousemove', function (e) { if (stage.classList.contains('is-zoom')) zoomAt(e.clientX, e.clientY); });
  stage.addEventListener('mouseleave', function () { stage.classList.remove('is-zoom'); });
  stage.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') show(state.img + 1);
    if (e.key === 'ArrowLeft') show(state.img - 1);
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stage.classList.toggle('is-zoom'); H.$('.stage__img.is-current', stage).style.transformOrigin = '50% 40%'; }
    if (e.key === 'Escape') stage.classList.remove('is-zoom');
  });
  // touch swipe
  var sx = null;
  stage.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', function (e) {
    if (sx == null) return; var dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 40) show(state.img + (dx < 0 ? 1 : -1));
  });
  // preload the rest
  setTimeout(function () { p.images.forEach(function (im) { var i = new Image(); i.src = H.img(im.key); }); }, 1200);

  /* ---- size / qty ---- */
  var sizesEl = H.$('#sizes');
  function setSize(s) {
    state.size = s;
    H.$$('.size', sizesEl).forEach(function (b) { var on = b.getAttribute('data-size') === s; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
    H.$('#sizeChosen').textContent = '— ' + s;
    H.$('#sizeErr').textContent = ''; sizesEl.classList.remove('is-error');
    update();
  }
  sizesEl.addEventListener('click', function (e) { var b = e.target.closest('.size'); if (b) setSize(b.getAttribute('data-size')); });
  sizesEl.addEventListener('keydown', function (e) {
    var btns = H.$$('.size', sizesEl), i = btns.indexOf(document.activeElement);
    if (i < 0 || ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].indexOf(e.key) === -1) return;
    e.preventDefault();
    var n = btns[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : btns.length - 1)) % btns.length];
    n.focus(); setSize(n.getAttribute('data-size'));
  });
  function setQty(q) { state.qty = Math.max(1, Math.min(S.PRICING.maxQtyPerLine, q)); update(); }
  H.$('#qtyDec').addEventListener('click', function () { setQty(state.qty - 1); });
  H.$('#qtyInc').addEventListener('click', function () { setQty(state.qty + 1); });

  function update() {
    H.$('#qtyVal').textContent = state.qty;
    H.$('#qtyDec').disabled = state.qty <= 1;
    H.$('#qtyInc').disabled = state.qty >= S.PRICING.maxQtyPerLine;
    H.$('#addPrice').textContent = S.formatPKR(p.price * state.qty);
    H.$('#buybarPrice').textContent = S.formatPKR(p.price * state.qty);
    H.$('#buybarSize').textContent = state.size ? 'Size ' + state.size + ' · Qty ' + state.qty : 'Select a size';
    var msg;
    if (state.size) {
      var t = S.computeTotals([{ id: p.id, size: state.size, qty: state.qty }], 'cod');
      msg = S.whatsappOrderText(t, { heading: 'Hi HypeNook! I’d like to order:' }) + '\n(Online payment total: ' + S.formatPKR(S.computeTotals(t.items, 'online').total) + ')';
    } else {
      msg = 'Hi HypeNook! I’m interested in the ' + p.name + ' (' + S.formatPKR(p.price) + '). Which sizes are available?';
    }
    H.$('#waLink').href = S.whatsappLink(msg);
  }
  function requireSize() {
    if (state.size) return true;
    H.$('#sizeErr').textContent = 'Please select a size.';
    sizesEl.classList.remove('is-error'); void sizesEl.offsetWidth; sizesEl.classList.add('is-error');
    sizesEl.scrollIntoView({ behavior: H.reduceMotion ? 'auto' : 'smooth', block: 'center' });
    H.$('.size', sizesEl).focus();
    return false;
  }
  function add() { if (requireSize()) H.addToCart(p.id, state.size, state.qty, H.$('.stage__img.is-current', stage)); }
  H.$('#addBtn').addEventListener('click', add);
  H.$('#buybarAdd').addEventListener('click', add);
  H.$('#buyBtn').addEventListener('click', function () {
    if (!requireSize()) return;
    // Buy now: checkout with only this item (bag is left untouched)
    try { sessionStorage.setItem('hn_buynow', JSON.stringify([{ id: p.id, size: state.size, qty: state.qty }])); } catch (e) {}
    location.href = 'checkout.html?mode=buynow';
  });
  update();

  /* ---- sticky mobile buy bar ---- */
  var bar = H.$('#buybar');
  document.body.classList.add('has-buybar');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      var on = !en[0].isIntersecting && en[0].boundingClientRect.top < 0;
      bar.classList.toggle('is-on', on); bar.setAttribute('aria-hidden', String(!on));
    }).observe(H.$('#addBtn'));
  }

  /* ---- reviews ---- */
  if (window.HN_REVIEWS) { HN_REVIEWS.renderBadge(H.$('#ratingBadge'), p); HN_REVIEWS.renderSection(H.$('#reviews'), p); }
  else H.$('#reviews').remove();

  /* ---- lookbook ---- */
  var lk = [p.images[0], p.images[1], p.images[2]];
  H.$('#lookbook').innerHTML = lk.map(function (im, i) {
    return '<div class="tile ' + ['tile--a', 'tile--b', 'tile--c'][i] + ' mask"><img src="' + H.img(im.key) + '" alt="' + H.esc(im.alt) + '" loading="lazy" decoding="async" width="1200" height="1490"' + (i === 0 ? ' style="object-position:50% 35%"' : '') + '></div>';
  }).join('');
})();
