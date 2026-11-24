/* HypeNook — checkout */
(function () {
  'use strict';
  var S = window.HN_STORE, H = window.HN;
  var form = H.$('#checkoutForm');
  var buyNow = new URLSearchParams(location.search).get('mode') === 'buynow';
  var gateway = { checked: false, available: false };

  function getLines() {
    if (buyNow) { try { return S.normaliseLines(JSON.parse(sessionStorage.getItem('hn_buynow') || '[]')); } catch (e) { return []; } }
    return S.normaliseLines(H.Cart.read());
  }
  function setLines(lines) {
    lines = lines.map(function (l) { return { id: l.id, size: l.size, qty: l.qty }; });
    if (buyNow) { try { sessionStorage.setItem('hn_buynow', JSON.stringify(lines)); } catch (e) {} render(); }
    else H.Cart.write(lines); // triggers cart:change → render
  }
  function method() { return (form.querySelector('input[name="paymentMethod"]:checked') || {}).value || 'cod'; }

  /* restore saved customer details (this browser only) */
  try {
    var saved = JSON.parse(localStorage.getItem('hn_customer') || 'null');
    if (saved) ['name', 'phone', 'email', 'address', 'city', 'province', 'postalCode'].forEach(function (k) { if (saved[k] && form.elements[k]) form.elements[k].value = saved[k]; });
  } catch (e) {}

  function render() {
    var lines = getLines();
    var t = S.computeTotals(lines, method());
    if (!t.items.length) {
      H.$('#checkoutWrap').innerHTML = '<div class="empty" style="grid-column:1/-1;padding:80px 0 140px"><p class="display">Your bag is empty</p><p style="margin-bottom:30px">Add something to your bag to check out.</p><a class="btn" href="shop.html"><span class="btn__label">Shop the collection</span></a></div>';
      return;
    }
    // items editor (size + qty per line)
    H.$('#itemsEditor').innerHTML = t.items.map(function (l, i) {
      var p = S.getProduct(l.id);
      return '<div class="line-item" data-i="' + i + '" style="animation:none"><img src="' + H.img(p.images[0].key, true) + '" alt="" width="84" height="92">' +
        '<div><div class="line-item__top"><p class="line-item__name">' + H.esc(p.name) + '</p><span>' + S.formatPKR(l.lineTotal) + '</span></div>' +
        '<div class="line-item__controls"><label style="font-size:12px;color:var(--muted)" for="csz' + i + '">Size</label><select class="mini-select" id="csz' + i + '" data-act="size">' +
        p.sizes.map(function (s) { return '<option' + (s === l.size ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
        '<div class="qty" role="group" aria-label="Quantity"><button type="button" data-act="dec" aria-label="Decrease quantity">−</button><output>' + l.qty + '</output><button type="button" data-act="inc" aria-label="Increase quantity"' + (l.qty >= S.PRICING.maxQtyPerLine ? ' disabled' : '') + '>+</button></div>' +
        '<button type="button" class="remove" data-act="remove">Remove</button></div></div></div>';
    }).join('');
    // summary
    H.$('#sumLines').innerHTML = t.items.map(function (l) {
      var p = S.getProduct(l.id);
      return '<div class="sum-line"><img src="' + H.img(p.images[0].key, true) + '" alt="" width="64" height="70"><div><div class="sum-line__name">' + H.esc(p.name) + '</div><div class="sum-line__meta">Size ' + l.size + ' · Qty ' + l.qty + '</div></div><div>' + S.formatPKR(l.lineTotal) + '</div></div>';
    }).join('');
    H.$('#sumTotals').innerHTML = H.totalsHTML(t, { showMethod: true }) +
      (t.paymentMethod === 'cod' ? '<p class="note" style="font-size:12px;color:var(--muted);margin:10px 0 0">Pay online instead and save ' + S.formatPKR(S.PRICING.onlineDiscount) + ' — total ' + S.formatPKR(S.computeTotals(lines, 'online').total) + '.</p>' : '');
    H.$('#waOrder').href = S.whatsappLink(S.whatsappOrderText(t));
    renderPayNotice(t);
  }

  function renderPayNotice(t) {
    var n = H.$('#payNotice'), btn = H.$('#placeBtn'), label = H.$('.btn__label', btn);
    if (t.paymentMethod === 'online' && gateway.available) {
      // a card/wallet gateway has been configured on the server
      n.innerHTML = '<div class="notice notice--ok"><strong>' + S.formatPKR(S.PRICING.onlineDiscount) + ' discount applied.</strong> You’ll be taken to our payment provider’s secure page to pay ' + S.formatPKR(t.total) + '.</div>';
      btn.disabled = false;
      label.textContent = 'Continue to payment — ' + S.formatPKR(t.total);
    } else if (t.paymentMethod === 'online') {
      n.innerHTML = '<div class="notice notice--ok"><strong>' + S.formatPKR(S.PRICING.onlineDiscount) + ' discount applied.</strong> After you place your order, transfer <strong>' + S.formatPKR(t.total) + '</strong> to the account below and send us the payment screenshot on WhatsApp. We confirm and dispatch your order once the payment is received.</div>' +
        H.bankBox(t.total);
      btn.disabled = false;
      label.textContent = 'Place order — ' + S.formatPKR(t.total);
    } else {
      n.innerHTML = '<div class="notice">Pay <strong>' + S.formatPKR(t.total) + '</strong> in cash when your order is delivered. The Rs. 150 online discount does not apply to Cash on Delivery.</div>';
      btn.disabled = false;
      label.textContent = 'Place order — ' + S.formatPKR(t.total);
    }
  }

  function checkGateway() {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 6000);
    fetch('api/payment/status', { signal: ctrl && ctrl.signal, headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : { configured: false }; })
      .then(function (d) { gateway.available = !!(d && d.configured); })
      .catch(function () { gateway.available = false; })
      .then(function () { clearTimeout(timer); gateway.checked = true; render(); });
  }

  /* events */
  H.$('#itemsEditor').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b || b.tagName === 'SELECT') return;
    var i = +b.closest('.line-item').getAttribute('data-i'), lines = getLines(), l = lines[i]; if (!l) return;
    var act = b.getAttribute('data-act');
    if (act === 'inc') l.qty = Math.min(l.qty + 1, S.PRICING.maxQtyPerLine);
    if (act === 'dec') { if (l.qty <= 1) lines.splice(i, 1); else l.qty -= 1; }
    if (act === 'remove') lines.splice(i, 1);
    setLines(lines);
  });
  H.$('#itemsEditor').addEventListener('change', function (e) {
    if (e.target.getAttribute('data-act') !== 'size') return;
    var i = +e.target.closest('.line-item').getAttribute('data-i'), lines = getLines();
    lines[i].size = e.target.value;
    // merge duplicate id+size
    var merged = [];
    lines.forEach(function (l) { var m = merged.filter(function (x) { return x.id === l.id && x.size === l.size; })[0]; if (m) m.qty = Math.min(m.qty + l.qty, S.PRICING.maxQtyPerLine); else merged.push(l); });
    setLines(merged);
  });
  form.addEventListener('change', function (e) { if (e.target.name === 'paymentMethod') render(); });
  if (!buyNow) document.addEventListener('cart:change', render);
  // clear a field's error as the user fixes it
  form.addEventListener('input', function (e) { var f = e.target.closest('.field'); if (f) f.classList.remove('has-error'); });

  function showErrors(errors) {
    H.$$('.field', form).forEach(function (f) { f.classList.remove('has-error'); });
    var first = null;
    Object.keys(errors || {}).forEach(function (k) {
      var f = form.querySelector('[data-field="' + k + '"]'); if (!f) return;
      f.classList.add('has-error'); H.$('.field-error', f).textContent = errors[k];
      var input = f.querySelector('.input'); input.setAttribute('aria-invalid', 'true');
      if (!first) first = input;
    });
    if (first) { first.focus({ preventScroll: true }); first.scrollIntoView({ behavior: H.reduceMotion ? 'auto' : 'smooth', block: 'center' }); }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var errEl = H.$('#formError'); errEl.textContent = '';
    if (form.elements.company.value) return; // bot honeypot
    var fd = {}; ['name', 'phone', 'email', 'address', 'city', 'province', 'postalCode', 'notes'].forEach(function (k) { fd[k] = form.elements[k].value; });
    var v = S.validateCustomer(fd);
    H.$$('.input', form).forEach(function (i) { i.removeAttribute('aria-invalid'); });
    if (!v.ok) { showErrors(v.errors); errEl.textContent = 'Please check the highlighted fields.'; return; }
    var lines = getLines();
    var pm = method();
    var t = S.computeTotals(lines, pm);
    if (!t.items.length) return;
    try { localStorage.setItem('hn_customer', JSON.stringify(v.value)); } catch (x) {}

    var btn = H.$('#placeBtn'); btn.classList.add('is-loading'); btn.disabled = true;
    var payload = { items: lines.map(function (l) { return { id: l.id, size: l.size, qty: l.qty }; }), customer: v.value, paymentMethod: pm };
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);

    fetch('api/order', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload), signal: ctrl && ctrl.signal })
      .then(function (r) {
        var ct = r.headers.get('content-type') || '';
        if (!/json/.test(ct)) throw { offline: true, status: r.status };
        return r.json().then(function (d) { return { status: r.status, data: d }; });
      })
      .then(function (res) {
        var d = res.data;
        if (res.status === 422 && d.errors) { showErrors(d.errors); throw { message: 'Please check the highlighted fields.' }; }
        if (!d.ok) throw { message: d.message || 'We couldn’t place your order. Please try again or order on WhatsApp.' };
        saveAndContinue(d.order, d.redirectUrl);
      })
      .catch(function (err) {
        if (err && (err.offline || err.name === 'AbortError' || err instanceof TypeError) && !gateway.available) {
          // No order server reachable (e.g. static hosting): we do NOT pretend the order was received.
          // The confirmation page asks the customer to send it to us on WhatsApp.
          var order = {
            orderNumber: S.makeOrderNumber(), createdAt: new Date().toISOString(), status: 'not_sent',
            paymentMethod: pm, customer: v.value, totals: t
          };
          saveAndContinue(order, null);
          return;
        }
        var msg = err && err.message ? err.message :
          (pm === 'online' ? 'We couldn’t reach the payment service. No payment has been taken. Please try again, choose Cash on Delivery, or order on WhatsApp.' : 'Something went wrong. Please try again or order on WhatsApp.');
        errEl.textContent = msg;
        btn.classList.remove('is-loading'); btn.disabled = false;
      })
      .then(function () { clearTimeout(timer); });
  });

  function saveAndContinue(order, redirectUrl) {
    try { sessionStorage.setItem('hn_last_order', JSON.stringify(order)); localStorage.setItem('hn_last_order', JSON.stringify(order)); } catch (e) {}
    if (redirectUrl) { location.href = redirectUrl; return; } // gateway's hosted payment page
    if (buyNow) { try { sessionStorage.removeItem('hn_buynow'); } catch (e) {} }
    else if (order.status !== 'not_sent') H.Cart.clear(); // keep the bag until the order actually reaches us
    location.href = 'order.html?order=' + encodeURIComponent(order.orderNumber);
  }

  render();
  checkGateway();
})();
