/* HypeNook — home page: featured product quick-buy */
(function () {
  'use strict';
  var S = window.HN_STORE, H = window.HN;
  if (window.HN_REVIEWS) HN_REVIEWS.renderHome(H.$('#homeReviews'));
  var p = S.getProduct('noir-graphic-oversized-hoodie');
  var wrap = H.$('#featSizes'), err = H.$('#featErr'), label = H.$('#featSizeLabel');
  var selected = null;
  wrap.innerHTML = p.sizes.map(function (s, i) {
    return '<button type="button" class="size" role="radio" aria-checked="false" tabindex="' + (i === 0 ? 0 : -1) + '" data-size="' + s + '">' + s + '</button>';
  }).join('');
  function select(s) {
    selected = s; err.textContent = ''; wrap.classList.remove('is-error');
    label.textContent = 'Size ' + s;
    H.$$('.size', wrap).forEach(function (b) { var on = b.getAttribute('data-size') === s; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
  }
  wrap.addEventListener('click', function (e) { var b = e.target.closest('.size'); if (b) select(b.getAttribute('data-size')); });
  wrap.addEventListener('keydown', function (e) {
    var btns = H.$$('.size', wrap), i = btns.indexOf(document.activeElement);
    if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].indexOf(e.key) === -1 || i < 0) return;
    e.preventDefault();
    var n = btns[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : btns.length - 1)) % btns.length];
    n.focus(); select(n.getAttribute('data-size'));
  });
  H.$('#featAdd').addEventListener('click', function () {
    if (!selected) {
      err.textContent = 'Please select a size.';
      wrap.classList.remove('is-error'); void wrap.offsetWidth; wrap.classList.add('is-error');
      return;
    }
    H.addToCart(p.id, selected, 1, H.$('#featured .feature__media .mask img'));
  });
})();
