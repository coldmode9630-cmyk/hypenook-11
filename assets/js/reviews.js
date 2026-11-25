/*!
 * HypeNook — customer reviews
 * Shows ONLY real, approved reviews (Supabase via /api/reviews, plus assets/data/reviews.json).
 * New reviews go to the shop owner for checking first (POST /api/review,
 * or WhatsApp if the server isn't available). Nothing is auto-published.
 */
(function () {
  'use strict';
  var S = window.HN_STORE, H = window.HN;
  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5L2.5 9.4l6.6-.8z"/></svg>';
  var cache = null;
  var MAX_PHOTOS = 3, MAX_PHOTO_BYTES = 5 * 1024 * 1024, MAX_PHOTO_SIDE = 1600;
  var PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  /* Resize to max 1600px and re-encode as WEBP (JPEG if the browser can't) at ~80%. */
  function compressPhoto(file) {
    var load = window.createImageBitmap
      ? createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return createImageBitmap(file); })
      : new Promise(function (ok, no) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = no; i.src = URL.createObjectURL(file); });
    return load.then(function (img) {
      var w = img.width, h = img.height, k = Math.min(1, MAX_PHOTO_SIDE / Math.max(w, h));
      var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
      var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      if (img.close) img.close();
      function enc(type) { return new Promise(function (ok) { c.toBlob(ok, type, 0.8); }); }
      return enc('image/webp').then(function (b) { return b && b.type === 'image/webp' ? b : enc('image/jpeg'); });
    }).then(function (b) { if (!b) throw new Error('encode failed'); return b; });
  }

  /* Lightbox for review photos (closes with ×, Esc or a click outside the photo). */
  var lb = null, lbList = [], lbIndex = 0, lbReturn = null;
  function lbShow(i) {
    lbIndex = (i + lbList.length) % lbList.length;
    H.$('.lightbox__img', lb).src = lbList[lbIndex];
    H.$('.lightbox__count', lb).textContent = lbList.length > 1 ? (lbIndex + 1) + ' / ' + lbList.length : '';
    H.$$('.lightbox__nav', lb).forEach(function (b) { b.hidden = lbList.length < 2; });
  }
  function lbKey(e) {
    if (e.key === 'Escape') lbClose();
    else if (e.key === 'ArrowRight') lbShow(lbIndex + 1);
    else if (e.key === 'ArrowLeft') lbShow(lbIndex - 1);
    else if (e.key === 'Tab') { e.preventDefault(); H.$('.lightbox__close', lb).focus(); }
  }
  function lbOpen(list, i) {
    if (!lb) {
      lb = H.el('div', { class: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Review photo' });
      lb.innerHTML = '<button type="button" class="lightbox__close" aria-label="Close photo">×</button>' +
        '<button type="button" class="lightbox__nav lightbox__nav--prev" aria-label="Previous photo">‹</button>' +
        '<img class="lightbox__img" alt="Customer photo">' +
        '<button type="button" class="lightbox__nav lightbox__nav--next" aria-label="Next photo">›</button>' +
        '<span class="lightbox__count"></span>';
      document.body.appendChild(lb);
      lb.addEventListener('click', function (e) {
        if (e.target.closest('.lightbox__nav--prev')) return lbShow(lbIndex - 1);
        if (e.target.closest('.lightbox__nav--next')) return lbShow(lbIndex + 1);
        if (!e.target.closest('.lightbox__img')) lbClose();
      });
    }
    lbList = list; lbReturn = document.activeElement; lbShow(i);
    lb.classList.add('is-open'); document.addEventListener('keydown', lbKey);
    H.$('.lightbox__close', lb).focus();
  }
  function lbClose() {
    if (!lb) return;
    lb.classList.remove('is-open'); document.removeEventListener('keydown', lbKey);
    if (lbReturn && lbReturn.focus) lbReturn.focus();
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-rv-photo]'); if (!b) return;
    var wrap = b.closest('.review__photos');
    var list = H.$$('[data-rv-photo]', wrap).map(function (x) { return x.getAttribute('data-rv-photo'); });
    lbOpen(list, list.indexOf(b.getAttribute('data-rv-photo')));
  });

  // Approved reviews come from the database (GET /api/reviews); any reviews you
  // added by hand to assets/data/reviews.json are shown as well.
  function getList(url) {
    return fetch(url, { cache: 'no-cache', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok && /json/.test(r.headers.get('content-type') || '') ? r.json() : { reviews: [] }; })
      .then(function (d) { return d && Array.isArray(d.reviews) ? d.reviews : []; })
      .catch(function () { return []; });
  }
  function load() {
    if (cache) return cache;
    cache = Promise.all([getList('api/reviews'), getList('assets/data/reviews.json')])
      .then(function (lists) {
        return lists[0].concat(lists[1]).filter(function (r) {
          return r && r.name && r.text && r.rating >= 1 && r.rating <= 5;
        }).sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
      });
    return cache;
  }
  function forProduct(list, id) { return list.filter(function (r) { return !r.productId || r.productId === id; }); }
  function stats(list) {
    var dist = [0, 0, 0, 0, 0], sum = 0;
    list.forEach(function (r) { dist[r.rating - 1]++; sum += r.rating; });
    return { count: list.length, avg: list.length ? sum / list.length : 0, dist: dist };
  }
  function stars(value, cls) {
    var pct = Math.max(0, Math.min(100, value / 5 * 100));
    return '<span class="stars ' + (cls || '') + '" role="img" aria-label="' + value.toFixed(1) + ' out of 5 stars">' +
      '<span class="stars__base">' + STAR + STAR + STAR + STAR + STAR + '</span>' +
      '<span class="stars__fill" style="width:' + pct + '%">' + STAR + STAR + STAR + STAR + STAR + '</span></span>';
  }
  function fmtDate(d) {
    if (!d) return '';
    var x = new Date(d); if (isNaN(x)) return '';
    return x.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function card(r) {
    return '<article class="review" data-reveal>' +
      '<div class="review__top">' + stars(r.rating, 'stars--sm') + '<span class="review__date">' + H.esc(fmtDate(r.date)) + '</span></div>' +
      (r.title ? '<h3 class="review__title">' + H.esc(r.title) + '</h3>' : '') +
      '<p class="review__text">' + H.esc(r.text) + '</p>' +
      (Array.isArray(r.photos) && r.photos.length ? '<div class="review__photos">' + r.photos.filter(function (u) { return /^https?:\/\//.test(u); }).slice(0, MAX_PHOTOS).map(function (u, i) {
        return '<button type="button" data-rv-photo="' + H.esc(u) + '" aria-label="View photo ' + (i + 1) + ' from ' + H.esc(r.name) + '"><img src="' + H.esc(u) + '" alt="" loading="lazy" width="72" height="72"></button>';
      }).join('') + '</div>' : '') +
      '<p class="review__by"><strong>' + H.esc(r.name) + '</strong>' + (r.city ? ' · ' + H.esc(r.city) : '') +
        (r.size ? ' · Size ' + H.esc(r.size) : '') +
        (r.verified ? ' <span class="review__verified">Verified buyer</span>' : '') + '</p>' +
    '</article>';
  }

  /* ---------- product page section ---------- */
  function renderSection(root, product) {
    load().then(function (all) {
      var list = forProduct(all, product.id), st = stats(list);
      var head;
      if (st.count) {
        head = '<div class="rv-summary"><div class="rv-score"><span class="rv-avg">' + st.avg.toFixed(1) + '</span>' + stars(st.avg) +
          '<span class="rv-count">Based on ' + st.count + ' review' + (st.count === 1 ? '' : 's') + '</span></div>' +
          '<div class="rv-bars">' + [5, 4, 3, 2, 1].map(function (n) {
            var c = st.dist[n - 1], w = st.count ? c / st.count * 100 : 0;
            return '<div class="rv-bar"><span>' + n + ' ★</span><span class="rv-bar__track"><span style="width:' + w + '%"></span></span><span>' + c + '</span></div>';
          }).join('') + '</div></div>';
      } else {
        head = '<div class="rv-empty"><p class="display h-sm">No reviews yet</p><p>Bought the ' + H.esc(product.shortName) + '? Be the first to tell your story.</p></div>';
      }
      root.innerHTML =
        '<div class="sec-head"><div><p class="eyebrow">Reviews</p><h2 class="display h-md" style="margin-top:14px">What people<br>are saying.</h2></div>' +
        '<button class="btn btn--ghost" type="button" id="writeReview"><span class="btn__label">Write a review</span></button></div>' +
        head +
        (st.count ? '<div class="reviews" id="reviewList">' + list.slice(0, 6).map(card).join('') + '</div>' +
          (list.length > 6 ? '<div style="text-align:center;margin-top:30px"><button class="btn btn--ghost" type="button" id="moreReviews"><span class="btn__label">Show all ' + list.length + ' reviews</span></button></div>' : '') : '');
      H.$('#writeReview').addEventListener('click', function () { openForm(product); });
      var more = H.$('#moreReviews');
      if (more) more.addEventListener('click', function () { H.$('#reviewList').innerHTML = list.map(card).join(''); more.remove(); H.initReveal(); });
      H.initReveal();
      if (st.count) injectSchema(product, st);
    });
  }

  /* small rating line under the product title */
  function renderBadge(el, product) {
    load().then(function (all) {
      var st = stats(forProduct(all, product.id));
      el.innerHTML = st.count
        ? '<a href="#reviews" class="rv-badge">' + stars(st.avg, 'stars--sm') + '<span>' + st.avg.toFixed(1) + ' · ' + st.count + ' review' + (st.count === 1 ? '' : 's') + '</span></a>'
        : '<a href="#reviews" class="rv-badge rv-badge--empty">No reviews yet — write the first</a>';
    });
  }

  /* home page: section stays hidden until there is at least one real review */
  function renderHome(section) {
    var product = S.PRODUCTS[0];
    H.$('#homeWriteReview', section).addEventListener('click', function () { openForm(product); });
    load().then(function (all) {
      var st = stats(all);
      if (!all.length) {
        H.$('#homeReviewScore', section).innerHTML = '';
        H.$('#homeReviewList', section).innerHTML = '<div class="rv-empty" style="grid-column:1/-1"><p class="display h-sm">No reviews yet</p><p>Bought the ' + H.esc(product.shortName) + '? Be the first to tell your story.</p></div>';
        var all_ = H.$('#homeAllReviews', section); if (all_) all_.remove();
      } else {
        H.$('#homeReviewScore', section).innerHTML = stars(st.avg) + '<span>' + st.avg.toFixed(1) + ' from ' + st.count + ' review' + (st.count === 1 ? '' : 's') + '</span>';
        H.$('#homeReviewList', section).innerHTML = all.slice(0, 3).map(card).join('');
      }
      H.initReveal();
    });
  }

  function injectSchema(product, st) {
    var s = document.createElement('script'); s.type = 'application/ld+json';
    s.textContent = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'Product', name: product.name, brand: { '@type': 'Brand', name: 'HypeNook' },
      aggregateRating: { '@type': 'AggregateRating', ratingValue: st.avg.toFixed(1), reviewCount: st.count }
    });
    document.head.appendChild(s);
  }

  /* ---------- write-a-review form ---------- */
  var modal = null;
  function openForm(product) {
    if (!modal) {
      modal = H.el('div', { class: 'modal', id: 'reviewModal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'reviewModalTitle', 'aria-hidden': 'true' });
      document.body.appendChild(modal);
    }
    modal.innerHTML =
      '<div class="modal__scrim" data-close></div><div class="modal__panel" tabindex="-1">' +
      '<button class="modal__close" type="button" data-close aria-label="Close">' + '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 5l14 14M19 5L5 19"/></svg></button>' +
      '<h2 class="display h-sm" id="reviewModalTitle">Write a review</h2>' +
      '<p style="color:var(--muted);margin:-6px 0 22px">' + H.esc(product.name) + '. Reviews appear after we’ve checked them.</p>' +
      '<form id="reviewForm" novalidate>' +
        '<div class="field" data-field="rating"><label id="rvRateLbl">Your rating</label><div class="star-input" role="radiogroup" aria-labelledby="rvRateLbl">' +
          [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" role="radio" aria-checked="false" aria-label="' + n + ' star' + (n > 1 ? 's' : '') + '" data-v="' + n + '" tabindex="' + (n === 1 ? 0 : -1) + '">' + STAR + '</button>'; }).join('') +
        '</div><p class="field-error"></p></div>' +
        '<div class="grid-2"><div class="field" data-field="name"><label for="rv_name">Name</label><input class="input" id="rv_name" name="name" maxlength="60" autocomplete="name" required><p class="field-error"></p></div>' +
        '<div class="field"><label for="rv_city">City <em>(optional)</em></label><input class="input" id="rv_city" name="city" maxlength="40" autocomplete="address-level2"></div></div>' +
        '<div class="field"><label for="rv_title">Headline <em>(optional)</em></label><input class="input" id="rv_title" name="title" maxlength="80"></div>' +
        '<div class="field" data-field="text"><label for="rv_text">Your review</label><textarea class="input" id="rv_text" name="text" maxlength="1000" required placeholder="Fit, feel, quality, delivery…"></textarea><p class="field-error"></p></div>' +
        '<div class="field" data-field="photos"><label for="rv_photos">Add photos <em>(optional, up to ' + MAX_PHOTOS + ')</em></label>' +
          '<div class="rv-photos"><div class="rv-photos__list" id="rvPhotoList"></div>' +
          '<label class="rv-photos__add" id="rvPhotoAdd"><input id="rv_photos" type="file" accept="image/jpeg,image/png,image/webp" multiple>' +
          '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>Add</span></label></div>' +
          '<p class="rv-photos__hint">JPG, PNG or WEBP · max 5 MB each</p><p class="field-error"></p></div>' +
        '<div class="grid-2"><div class="field"><label for="rv_size">Size you bought <em>(optional)</em></label><select class="input" id="rv_size" name="size"><option value="">—</option>' + product.sizes.map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="rv_order">Order number <em>(optional)</em></label><input class="input" id="rv_order" name="orderNumber" maxlength="30" placeholder="HN-…"></div></div>' +
        '<div style="position:absolute;left:-9999px" aria-hidden="true"><input name="company" tabindex="-1" autocomplete="off"></div>' +
        '<button class="btn btn--block" type="submit"><span class="btn__label">Submit review</span></button>' +
        '<p class="form-error" role="alert"></p>' +
      '</form><div id="reviewDone" hidden></div></div>';
    H.openModal('reviewModal');

    var form = H.$('#reviewForm', modal), rating = 0;
    var starBtns = H.$$('.star-input button', modal);
    function setRating(v) {
      rating = v;
      starBtns.forEach(function (b) { var n = +b.getAttribute('data-v'); b.classList.toggle('on', n <= v); b.setAttribute('aria-checked', String(n === v)); b.tabIndex = n === v ? 0 : -1; });
      H.$('[data-field="rating"]', modal).classList.remove('has-error');
    }
    starBtns.forEach(function (b) {
      b.addEventListener('click', function () { setRating(+b.getAttribute('data-v')); });
      b.addEventListener('mouseenter', function () { var v = +b.getAttribute('data-v'); starBtns.forEach(function (x) { x.classList.toggle('hover', +x.getAttribute('data-v') <= v); }); });
      b.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); var v = Math.min(5, (rating || 0) + 1); setRating(v); starBtns[v - 1].focus(); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); var w = Math.max(1, (rating || 2) - 1); setRating(w); starBtns[w - 1].focus(); }
      });
    });
    H.$('.star-input', modal).addEventListener('mouseleave', function () { starBtns.forEach(function (x) { x.classList.remove('hover'); }); });
    form.addEventListener('input', function (e) { var f = e.target.closest('.field'); if (f) f.classList.remove('has-error'); });

    /* ---- photos: pick → check → compress in the browser → preview ---- */
    var photos = []; // { blob, url }
    var photoInput = H.$('#rv_photos', modal), photoBusy = 0;
    function photoError(msg) {
      var f = H.$('[data-field="photos"]', modal);
      f.classList.toggle('has-error', !!msg); H.$('.field-error', f).textContent = msg || '';
    }
    function drawPhotos() {
      H.$('#rvPhotoList', modal).innerHTML = photos.map(function (p, i) {
        return '<div class="rv-photos__item"><img src="' + p.url + '" alt="Photo ' + (i + 1) + '"><button type="button" data-rm="' + i + '" aria-label="Remove photo ' + (i + 1) + '">×</button></div>';
      }).join('');
      H.$('#rvPhotoAdd', modal).hidden = photos.length + photoBusy >= MAX_PHOTOS;
    }
    H.$('#rvPhotoList', modal).addEventListener('click', function (e) {
      var b = e.target.closest('[data-rm]'); if (!b) return;
      var p = photos.splice(+b.getAttribute('data-rm'), 1)[0]; if (p) URL.revokeObjectURL(p.url);
      photoError(''); drawPhotos();
    });
    photoInput.addEventListener('change', function () {
      var files = Array.prototype.slice.call(photoInput.files || []); photoInput.value = '';
      photoError('');
      var room = MAX_PHOTOS - photos.length - photoBusy;
      if (files.length > room) { photoError('You can add up to ' + MAX_PHOTOS + ' photos.'); files = files.slice(0, Math.max(0, room)); }
      files.forEach(function (file) {
        if (PHOTO_TYPES.indexOf(file.type) === -1) { photoError('Only JPG, PNG or WEBP photos, please.'); return; }
        if (file.size > MAX_PHOTO_BYTES) { photoError('“' + file.name + '” is over 5 MB.'); return; }
        photoBusy++; drawPhotos();
        compressPhoto(file).then(function (blob) {
          if (blob.size > MAX_PHOTO_BYTES) throw new Error('too big');
          photos.push({ blob: blob, url: URL.createObjectURL(blob) });
        }).catch(function () { photoError('Couldn’t read “' + file.name + '”. Try another photo.'); })
          .then(function () { photoBusy--; drawPhotos(); });
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = { productId: product.id, rating: rating, name: form.name.value.trim(), city: form.city.value.trim(), title: form.title.value.trim(), text: form.text.value.trim(), size: form.size.value, orderNumber: form.orderNumber.value.trim(), company: form.company.value };
      var errs = {};
      if (!rating) errs.rating = 'Please choose a star rating.';
      if (v.name.length < 2) errs.name = 'Please enter your name.';
      if (v.text.length < 10) errs.text = 'Please write at least a few words (10+ characters).';
      if (photoBusy) errs.photos = 'Your photos are still being prepared — one moment.';
      if (showErrs(errs)) return;
      v.photos = photos.map(function (p) { return { type: p.blob.type, size: p.blob.size }; });
      var btn = H.$('button[type="submit"]', form); btn.classList.add('is-loading');
      fetch('api/review', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(v) })
        .then(function (r) {
          if (!/json/.test(r.headers.get('content-type') || '')) throw { offline: true };
          return r.json().then(function (d) { return { status: r.status, d: d }; });
        })
        .then(function (res) {
          if (res.status === 422) { showErrs(res.d.errors || {}); throw { msg: res.d.message }; }
          if (!res.d.ok) throw { msg: res.d.message };
          return uploadPhotos(res.d).then(function (ps) { done(res.d.stored, v, ps); });
        })
        .catch(function (err) {
          btn.classList.remove('is-loading');
          if (err && err.msg) { H.$('.form-error', form).textContent = err.msg; return; }
          done(false, v, photos.length ? 'whatsapp' : 'none'); // no server reachable → send it on WhatsApp instead
        });
    });
    function showErrs(errs) {
      var keys = Object.keys(errs);
      keys.forEach(function (k) { var f = H.$('[data-field="' + k + '"]', modal); if (f) { f.classList.add('has-error'); H.$('.field-error', f).textContent = errs[k]; } });
      return keys.length > 0;
    }
    // Upload each photo straight to storage with the signed URL the server issued, then confirm.
    function uploadPhotos(d) {
      if (!photos.length) return Promise.resolve('none');
      if (!d.stored) return Promise.resolve('whatsapp');
      var ups = d.uploads || [];
      if (!d.id || ups.length !== photos.length) return Promise.resolve('failed');
      return Promise.all(ups.map(function (u, i) {
        return fetch(u.url, { method: 'PUT', headers: { 'Content-Type': photos[i].blob.type, 'x-upsert': 'false' }, body: photos[i].blob })
          .then(function (r) { if (!r.ok) throw new Error('upload ' + r.status); });
      })).then(function () {
        return fetch('api/review', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ action: 'photos', id: d.id }) })
          .then(function (r) { return r.json(); }).then(function (x) { return x && x.ok && x.photos ? 'ok' : 'failed'; });
      }).catch(function () { return 'failed'; });
    }
    function done(stored, v, photoState) {
      var photoNote = photoState === 'failed' ? '<p style="color:var(--danger);margin-top:10px">Your review was sent, but the photos couldn’t be uploaded.</p>'
        : photoState === 'whatsapp' ? '<p style="color:var(--muted);margin-top:10px">Attach your photos in the WhatsApp chat too.</p>' : '';
      form.hidden = true;
      var box = H.$('#reviewDone', modal); box.hidden = false;
      var waText = 'Hi HypeNook! Here’s my review of the ' + product.name + ':\n' +
        '★'.repeat(v.rating) + '☆'.repeat(5 - v.rating) + ' (' + v.rating + '/5)\n' + (v.title ? v.title + '\n' : '') + v.text + '\n— ' + v.name + (v.city ? ', ' + v.city : '') + (v.size ? ' (Size ' + v.size + ')' : '') + (v.orderNumber ? '\nOrder: ' + v.orderNumber : '');
      box.innerHTML = stored
        ? '<p class="display h-sm" style="margin-bottom:10px">Thank you!</p><p style="color:var(--muted)">Your review has been sent. It will appear on the site once we’ve checked it.</p>' + photoNote + '<button class="btn btn--block" type="button" data-close style="margin-top:20px"><span class="btn__label">Close</span></button>'
        : '<p class="display h-sm" style="margin-bottom:10px">One more tap</p><p style="color:var(--muted)">Send your review to us on WhatsApp. It will appear on the site once we’ve checked it.</p>' + photoNote +
          '<a class="btn btn--green btn--block" style="margin-top:20px" target="_blank" rel="noopener" href="' + S.whatsappLink(waText) + '"><span class="btn__label">Send review on WhatsApp</span></a>';
      H.$$('[data-close]', modal).forEach(function (b) { if (!b.onclick) b.onclick = function () { H.$('.modal__close', modal).click(); }; });
    }
  }

  window.HN_REVIEWS = { load: load, renderSection: renderSection, renderBadge: renderBadge, renderHome: renderHome, stars: stars };
})();
