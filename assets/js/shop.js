/* HypeNook — shop / new arrivals listing */
(function () {
  'use strict';
  var S = window.HN_STORE, H = window.HN;
  var isNew = new URLSearchParams(location.search).get('filter') === 'new';
  var list = S.PRODUCTS.filter(function (p) { return !isNew || p.isNew; });
  if (isNew) {
    H.$('#shopTitle').innerHTML = 'New<br>arrivals';
    H.$('#crumbHere').textContent = 'New arrivals';
    H.$('#shopLede').textContent = 'Fresh from the studio — the latest HypeNook drop.';
    document.title = 'New Arrivals — HypeNook';
  }
  H.$(isNew ? '#chipNew' : '#chipAll').setAttribute('aria-current', 'page');
  H.$(isNew ? '#chipNew' : '#chipAll').setAttribute('aria-pressed', 'true');
  H.$('#shopCount').textContent = list.length + (list.length === 1 ? ' product' : ' products');
  H.$('#productGrid').innerHTML = list.map(H.productCard).join('') +
    '<div class="soon" data-reveal data-delay="0.15"><div><p class="eyebrow">Next drop</p><p class="display h-sm" style="margin-top:14px">More stories<br>coming soon</p>' +
    '<p>Follow <a class="link-u" href="' + S.BRAND.instagram + '" target="_blank" rel="noopener">' + S.BRAND.instagramHandle + '</a> to see new drops first.</p></div></div>';
})();
