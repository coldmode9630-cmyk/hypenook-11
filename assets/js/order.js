/* HypeNook — order confirmation */
(function () {
  'use strict';
  var S = window.HN_STORE, H = window.HN;
  var root = H.$('#confirm');
  var wanted = new URLSearchParams(location.search).get('order');
  var order = null;
  try { order = JSON.parse(sessionStorage.getItem('hn_last_order') || localStorage.getItem('hn_last_order') || 'null'); } catch (e) {}
  if (!order || (wanted && order.orderNumber !== wanted)) {
    root.innerHTML = '<p class="eyebrow">Order</p><h1 class="display h-md" style="margin:18px 0">We can’t show this order here</h1>' +
      '<p class="lede">Order details are only shown in the browser that placed the order. For help with an order, message us on WhatsApp with your order number.</p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:30px"><a class="btn" target="_blank" rel="noopener" href="' + S.whatsappLink('Hi HypeNook! I need help with my order' + (wanted ? ' ' + wanted : '') + '.') + '"><span class="btn__label">WhatsApp us</span></a><a class="btn btn--ghost" href="shop.html"><span class="btn__label">Continue shopping</span></a></div>';
    return;
  }
  // re-derive totals from the catalog for display
  var t = S.computeTotals(order.totals.items, order.paymentMethod);
  var c = order.customer;
  var waText = S.whatsappOrderText(t, { heading: 'Hi HypeNook! Please confirm my order.', orderNumber: order.orderNumber, customer: c });

  var isBank = order.paymentMethod === 'online' && !(order.payment && order.payment.provider);
  var amount = S.formatPKR(t.total);
  var waPrimary = { href: S.whatsappLink(waText), label: 'Message us on WhatsApp', strong: false };
  var st;
  if (isBank && order.status === 'not_sent') {
    waText = S.whatsappOrderText(t, { heading: 'Hi HypeNook! Here is my order. I’ve paid by bank transfer — screenshot attached.', orderNumber: order.orderNumber, customer: c });
    st = { pill: '<span class="status-pill">Action needed — pay &amp; send</span>', title: 'Two quick steps.',
      text: '<strong>1.</strong> Transfer <strong>' + amount + '</strong> to the account below.<br><strong>2.</strong> Tap <strong>Send order on WhatsApp</strong> and attach your payment screenshot. We’ll confirm and dispatch once the payment is received.' };
    waPrimary = { href: S.whatsappLink(waText), label: 'Send order on WhatsApp', strong: true };
  } else if (isBank) {
    st = { pill: '<span class="status-pill">Awaiting payment</span>', title: 'Order placed.<br>Now pay to confirm.',
      text: 'Transfer <strong>' + amount + '</strong> to the account below, then send us the payment screenshot on WhatsApp with your order number. We’ll confirm and dispatch your order once the payment is received.' };
    waPrimary = { href: S.whatsappLink(S.bankTransferText({ orderNumber: order.orderNumber, totals: t, customer: c })), label: 'Send payment screenshot', strong: true };
  } else if (order.status === 'not_sent') {
    st = { pill: '<span class="status-pill">Action needed — not sent yet</span>', title: 'One last step.', text: 'Your order hasn’t reached us yet. Tap <strong>Send order on WhatsApp</strong> below — it opens a chat with your full order filled in. We’ll confirm it there.' };
    waPrimary = { href: S.whatsappLink(waText), label: 'Send order on WhatsApp', strong: true };
  } else if (order.status === 'awaiting_payment') {
    st = { pill: '<span class="status-pill">Payment being confirmed</span>', title: 'Almost there.', text: 'Your order is placed and is waiting for confirmation from our payment provider. You’ll hear from us once your payment is confirmed. If you were charged but don’t hear from us, message us with your order number.' };
  } else {
    st = { pill: '<span class="status-pill ok">Order received</span>', title: 'Thank you.<br>Order received.', text: 'We’ve received your order and will call or WhatsApp you on ' + H.esc(c.phone) + ' to confirm before dispatch. Pay in cash when it arrives.' };
  }

  root.innerHTML =
    '<div class="confirm__check"><svg viewBox="0 0 24 24" fill="none" stroke="#F5F4F0" stroke-width="2"><path d="M4 12.5l5 5L20 6.5"/></svg></div>' +
    st.pill +
    '<h1 class="display h-md" style="margin:22px 0 18px" data-split data-hero>' + st.title + '</h1>' +
    '<p class="lede" style="max-width:60ch">' + st.text + '</p>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:30px">' +
      '<a class="btn' + (waPrimary.strong ? ' btn--green' : ' btn--ghost') + '" id="waSend" target="_blank" rel="noopener" href="' + waPrimary.href + '"><span class="btn__label">' + waPrimary.label + '</span></a>' +
      '<a class="btn btn--ghost" href="shop.html"><span class="btn__label">Continue shopping</span></a>' +
    '</div>' +
    (isBank ? '<div style="margin-top:36px;max-width:620px"><p class="eyebrow">Pay by bank transfer</p>' + H.bankBox(t.total) + '<p style="font-size:13px;color:var(--muted);margin-top:10px">Use your order number <strong style="color:var(--off)">' + H.esc(order.orderNumber) + '</strong> as the payment reference if your app allows it.</p></div>' : '') +
    '<div class="confirm__grid">' +
      '<div class="confirm__card"><h3>Order number</h3><p class="display h-sm">' + H.esc(order.orderNumber) + '</p><p style="color:var(--muted);font-size:13px;margin-top:8px">' + new Date(order.createdAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }) + '</p></div>' +
      '<div class="confirm__card"><h3>Payment method</h3><p>' + (order.paymentMethod === 'online' ? (isBank ? 'Online payment — bank transfer' : 'Online payment') : 'Cash on Delivery') + '</p></div>' +
      '<div class="confirm__card"><h3>Customer</h3><p>' + H.esc(c.name) + '</p><p>' + H.esc(c.phone) + '</p>' + (c.email ? '<p>' + H.esc(c.email) + '</p>' : '') + '</div>' +
      '<div class="confirm__card"><h3>Delivery address</h3><p>' + H.esc(c.address) + '</p><p>' + H.esc(c.city) + ', ' + H.esc(c.province) + (c.postalCode ? ' ' + H.esc(c.postalCode) : '') + '</p></div>' +
    '</div>' +
    '<div class="confirm__card" style="margin-top:20px"><h3>Ordered products</h3>' +
      t.items.map(function (l) {
        var p = S.getProduct(l.id);
        return '<div class="sum-line"><img src="' + H.img(p.images[0].key, true) + '" alt="" width="64" height="70"><div><div class="sum-line__name">' + H.esc(p.name) + '</div><div class="sum-line__meta">Size ' + l.size + ' · Qty ' + l.qty + ' · ' + S.formatPKR(l.unitPrice) + ' each</div></div><div>' + S.formatPKR(l.lineTotal) + '</div></div>';
      }).join('') +
      '<div style="margin-top:18px">' + H.totalsHTML(t, { showMethod: true }) + '</div>' +
    '</div>';
  H.initReveal();
})();
