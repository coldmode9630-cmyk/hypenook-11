/*!
 * HypeNook — shared site runtime (BROWSER ONLY — loaded by <script> tags, never run by Node)
 * Header / footer / mobile menu, cart (localStorage), cart drawer,
 * add-to-cart animation, loader, page transitions, scroll reveals, parallax.
 */
(function () {
  'use strict';
  var S = window.HN_STORE;
  var B = S.BRAND;
  var doc = document, body = doc.body;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- helpers ---------------- */
  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function el(tag, attrs, html) {
    var n = doc.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function img(key, small) { return 'assets/img/' + key + (small ? '-sm' : '') + '.webp'; }

  var ICON = {
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M5 8h14l-1 13H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>',
    arrow: '<svg class="arrow" width="18" height="10" viewBox="0 0 18 10" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M0 5h16M12 1l4 4-4 4"/></svg>',
    ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
    fb: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3z"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>',
    lock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="5" y="11" width="14" height="10"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'
  };
  // HypeNook wordmark (vectorised from the brand text logo)
  var WORD_D = 'M163.2 29.5 L148.8 29.5 L148.0 30.0 L146.8 34.0 L146.0 35.0 L146.0 36.0 L143.0 45.0 L142.0 46.8 L142.0 47.8 L141.0 49.8 L141.0 50.8 L139.0 55.8 L135.8 66.2 L135.2 66.8 L133.0 73.5 L133.0 74.5 L132.2 75.5 L132.0 77.2 L131.0 79.0 L131.0 80.0 L130.0 82.0 L129.0 86.0 L127.5 88.5 L125.8 89.5 L123.5 89.2 L121.8 87.5 L118.8 78.2 L115.8 70.5 L115.8 69.2 L114.8 67.5 L113.8 63.5 L113.0 62.5 L112.8 60.8 L109.0 50.5 L108.8 48.8 L107.0 44.8 L106.8 43.0 L106.0 41.8 L104.8 37.2 L102.8 33.2 L100.2 31.2 L97.8 30.2 L94.2 29.8 L86.8 29.5 L86.0 30.0 L86.0 31.2 L87.0 32.8 L87.0 34.0 L88.0 35.8 L88.0 36.8 L90.0 42.8 L90.8 44.0 L94.0 53.8 L94.0 54.8 L94.8 55.8 L96.0 59.5 L96.0 60.5 L96.5 61.0 L97.0 63.5 L101.0 74.2 L101.0 75.2 L102.0 77.2 L102.0 78.2 L104.0 82.8 L104.0 83.8 L107.0 92.5 L110.0 97.8 L112.8 100.8 L117.5 103.8 L121.2 104.5 L122.0 105.5 L121.0 108.0 L119.2 110.8 L116.0 114.2 L113.5 116.0 L108.5 118.0 L105.0 118.5 L99.5 118.5 L96.2 119.2 L94.2 120.5 L92.2 122.8 L90.0 128.2 L90.0 131.2 L91.5 132.0 L93.8 132.2 L95.5 133.0 L98.2 133.2 L106.8 133.2 L113.8 132.0 L119.0 130.0 L122.5 128.0 L128.2 123.0 L132.5 117.2 L136.8 109.2 L140.5 100.0 L141.0 97.8 L141.5 97.2 L142.0 95.0 L143.8 90.8 L143.8 89.8 L145.8 84.8 L145.8 83.8 L148.8 76.2 L148.8 75.2 L152.0 65.8 L152.8 64.5 L152.8 63.5 L154.8 58.5 L154.8 57.5 L155.8 55.5 L156.0 53.8 L156.5 53.2 L158.0 48.0 L158.8 46.8 L158.8 45.8 L159.8 43.8 L160.8 39.8 L162.8 35.0 L162.8 33.8 L163.8 32.0 L164.0 30.0Z M447.5 28.5 L442.2 29.2 L440.5 30.0 L438.5 30.2 L433.8 32.2 L427.0 36.5 L420.8 42.8 L417.0 48.2 L414.0 55.0 L412.5 63.0 L412.5 70.0 L414.0 78.2 L415.0 80.0 L416.0 83.2 L421.0 91.0 L426.0 96.0 L431.5 100.0 L435.5 102.0 L441.2 104.0 L447.5 105.0 L453.5 105.0 L460.0 104.0 L468.0 101.0 L474.2 97.0 L480.8 90.5 L484.8 84.2 L487.8 76.8 L488.8 71.8 L488.8 61.5 L487.8 58.0 L487.8 56.5 L484.5 48.5 L480.0 42.0 L474.8 36.8 L468.0 32.5 L462.8 30.2 L461.8 30.2 L459.2 29.2 L457.2 29.2 L454.2 28.5Z M446.8 44.0 L454.8 44.0 L457.2 45.0 L458.5 45.0 L462.8 47.2 L465.2 49.0 L468.8 52.5 L471.0 56.0 L473.0 61.0 L473.5 64.0 L473.5 69.5 L473.0 70.8 L473.0 72.5 L472.2 73.8 L472.0 75.2 L470.0 79.0 L468.5 81.0 L463.0 86.0 L459.0 88.0 L455.0 89.2 L446.5 89.2 L444.0 88.2 L442.8 88.2 L438.5 86.0 L435.5 83.8 L431.8 79.5 L429.2 74.5 L428.0 70.0 L428.0 63.5 L428.8 61.2 L428.8 59.8 L429.8 58.2 L429.8 57.5 L432.8 52.5 L438.5 47.2 L442.5 45.2 L444.2 45.0Z M532.2 28.2 L524.5 29.2 L521.8 30.2 L520.8 30.2 L519.2 31.2 L518.2 31.2 L517.2 32.0 L516.0 32.2 L511.8 34.8 L507.2 38.2 L505.0 40.5 L500.0 47.0 L497.0 53.0 L495.0 60.8 L494.8 69.0 L495.0 72.5 L496.0 75.8 L496.0 77.2 L496.8 78.5 L498.0 82.5 L502.2 89.8 L506.8 94.8 L512.2 99.0 L519.8 102.8 L522.2 103.2 L523.5 104.0 L525.0 104.0 L527.8 104.8 L536.2 105.0 L542.2 104.0 L544.5 103.0 L545.5 103.0 L552.2 100.0 L557.8 96.0 L561.8 92.0 L565.5 87.0 L567.8 83.0 L569.5 78.5 L570.8 73.5 L571.2 64.8 L570.8 59.8 L568.5 52.0 L566.5 48.0 L563.8 43.8 L557.5 37.2 L555.0 35.2 L550.8 33.0 L550.0 32.2 L545.0 30.2 L544.0 30.2 L541.5 29.2Z M528.8 44.0 L536.8 44.0 L543.5 46.2 L547.0 48.5 L551.0 52.5 L553.8 56.8 L555.0 59.8 L556.0 65.2 L556.0 68.2 L555.0 73.2 L553.8 76.5 L551.0 80.8 L547.0 84.8 L543.5 87.0 L538.5 89.0 L534.2 89.5 L528.8 89.2 L526.2 88.2 L525.2 88.2 L520.8 86.0 L517.2 83.2 L515.0 80.8 L513.0 77.8 L510.8 72.2 L510.2 68.8 L510.2 64.0 L511.0 60.2 L513.8 54.2 L515.0 52.5 L519.8 48.0 L520.2 48.0 L523.0 46.0Z M329.5 30.2 L329.8 103.8 L344.2 104.0 L344.8 103.5 L344.8 70.0 L345.8 62.5 L347.0 58.5 L349.0 54.5 L351.0 51.8 L355.2 48.0 L359.0 46.0 L361.2 45.2 L366.0 44.5 L373.2 45.0 L377.0 46.2 L380.2 48.0 L385.5 53.2 L387.0 55.5 L388.8 59.5 L390.0 64.0 L390.0 66.5 L390.5 67.5 L390.5 97.0 L391.0 99.8 L392.8 101.8 L394.8 103.0 L396.0 103.0 L399.5 104.0 L405.2 104.0 L405.8 103.5 L405.8 62.2 L403.8 53.0 L401.5 47.5 L398.8 43.0 L394.0 37.8 L390.2 34.8 L386.0 32.2 L378.2 29.5 L375.0 29.2 L373.5 28.8 L366.5 28.2 L359.5 29.2 L358.2 30.0 L355.8 30.5 L351.8 32.5 L349.0 34.5 L345.5 38.2 L344.8 37.8 L344.8 34.8 L343.8 33.0 L342.0 31.2 L339.5 30.2 L335.8 29.8 L330.0 29.8Z M282.8 28.2 L279.5 29.0 L275.8 29.2 L267.2 32.2 L266.5 33.0 L262.2 35.2 L259.0 37.8 L255.8 41.0 L251.2 47.0 L249.0 51.2 L247.2 55.8 L246.0 61.5 L245.8 68.8 L246.0 72.5 L247.0 75.5 L247.0 77.0 L248.0 80.0 L248.8 81.0 L249.0 82.5 L250.0 83.8 L250.0 84.5 L253.8 90.2 L259.5 96.2 L264.5 99.8 L268.8 102.0 L270.2 102.2 L271.5 103.0 L278.8 104.8 L287.5 105.0 L293.5 104.0 L299.5 102.0 L302.0 100.8 L308.8 96.0 L310.8 94.0 L310.8 93.0 L305.5 87.2 L302.0 85.2 L300.8 85.0 L297.8 85.2 L292.0 88.2 L289.5 89.0 L284.5 89.8 L279.5 89.2 L275.5 88.0 L271.8 86.0 L267.2 82.2 L265.0 79.5 L263.0 75.8 L263.0 75.0 L263.5 74.5 L316.8 74.2 L319.5 73.2 L321.5 71.0 L322.2 68.0 L322.2 64.2 L321.8 59.2 L321.0 57.5 L320.8 55.2 L319.8 53.5 L318.8 50.2 L315.8 45.0 L310.0 38.5 L304.5 34.2 L299.0 31.2 L298.0 31.2 L297.0 30.5 L295.2 30.2 L293.0 29.2Z M262.8 58.0 L266.8 51.8 L271.5 47.5 L276.5 45.0 L280.0 44.0 L285.2 43.8 L288.0 44.0 L292.2 45.2 L297.0 47.8 L299.2 49.5 L302.5 53.0 L305.0 57.0 L305.5 58.5 L304.8 59.2 L263.2 59.2 L262.8 58.8Z M224.0 35.5 L216.5 31.2 L215.5 31.2 L214.0 30.2 L211.8 30.0 L210.2 29.2 L203.0 28.2 L193.2 29.2 L187.0 31.2 L179.8 35.2 L175.0 39.2 L170.2 44.8 L168.2 48.0 L166.0 52.8 L165.8 54.2 L165.2 54.8 L164.0 59.8 L163.5 64.2 L163.8 121.8 L168.0 122.0 L174.2 121.0 L176.2 120.0 L177.8 118.5 L178.8 116.2 L178.8 98.5 L179.5 97.8 L182.5 100.0 L186.5 102.0 L192.2 104.0 L199.0 105.0 L207.0 104.8 L214.5 103.0 L222.5 99.0 L226.5 96.0 L231.0 91.5 L233.5 88.2 L235.8 84.5 L235.8 83.8 L236.5 83.0 L237.8 80.0 L237.8 79.0 L238.8 77.0 L238.8 75.8 L239.8 72.5 L240.0 65.5 L239.5 59.8 L239.0 59.0 L238.8 56.5 L238.0 55.2 L237.8 53.5 L234.5 46.8 L231.0 42.0Z M198.8 44.0 L205.0 44.0 L206.8 44.8 L208.8 45.0 L213.8 47.2 L219.0 51.8 L222.0 56.0 L224.0 61.2 L224.5 63.8 L224.8 67.8 L224.0 72.5 L223.0 75.5 L220.5 80.0 L216.2 84.5 L213.8 86.2 L210.5 88.0 L206.5 89.2 L203.8 89.2 L202.5 89.8 L197.0 89.2 L194.5 88.2 L193.5 88.2 L188.2 85.2 L184.2 81.5 L181.8 78.0 L180.0 74.0 L179.0 69.8 L179.0 64.0 L180.0 59.5 L183.5 53.0 L186.5 49.8 L189.8 47.2 L194.5 45.0Z M578.5 11.5 L577.8 12.2 L578.0 103.8 L592.8 103.8 L593.0 76.8 L595.2 73.8 L596.5 73.0 L598.5 72.5 L600.0 72.5 L602.5 73.2 L606.0 76.8 L608.0 81.5 L609.0 85.5 L611.0 90.0 L611.0 91.0 L612.0 93.0 L615.5 103.5 L616.5 104.0 L631.5 103.8 L631.8 103.2 L630.8 101.0 L630.8 100.0 L628.8 95.5 L628.8 94.5 L627.8 92.5 L627.8 91.5 L626.0 87.2 L623.8 80.5 L623.8 79.5 L623.0 78.5 L621.8 74.8 L621.8 73.8 L618.5 67.2 L615.8 64.0 L616.0 62.8 L618.8 59.8 L621.8 55.0 L623.0 51.8 L623.8 50.8 L623.8 49.8 L624.8 47.5 L625.8 42.5 L626.0 30.2 L625.5 29.8 L620.2 29.8 L616.5 30.2 L613.8 31.5 L612.2 33.0 L611.0 35.2 L610.8 41.2 L610.0 43.5 L610.0 44.8 L608.5 48.2 L606.5 51.2 L602.2 55.2 L597.2 58.0 L593.8 59.0 L593.0 58.5 L592.8 16.0 L591.0 13.8 L588.0 12.2Z M0.2 0.0 L0.0 103.5 L0.5 104.0 L15.2 104.0 L15.8 103.5 L15.8 53.0 L16.2 52.2 L62.0 52.2 L62.8 53.0 L62.8 103.2 L63.8 104.0 L78.2 103.8 L78.8 102.2 L78.5 6.0 L77.8 3.8 L74.8 1.2 L73.0 1.0 L72.2 0.5 L63.2 0.0 L62.8 0.5 L62.8 36.2 L62.0 37.0 L16.2 37.0 L15.8 36.2 L15.8 5.8 L15.0 4.0 L13.5 2.2 L12.0 1.2 L8.2 0.2Z';
  function wordmark(cls, outline) {
    return '<svg class="' + cls + '" viewBox="0 0 632.0 133.5" role="img" aria-label="HypeNook"><path fill-rule="evenodd" d="' + WORD_D + '"' +
      (outline ? ' fill="none" stroke="currentColor" stroke-width="0.9" vector-effect="non-scaling-stroke"' : ' fill="currentColor"') + '/></svg>';
  }
  // HypeNook logo mark (vectorised from the brand logo)
  var LOGO_MARK = '<svg class="logo__mark" viewBox="0 0 268.0 330.0" aria-hidden="true"><path fill="currentColor" d="M242.8 179.0 L241.0 176.5 L236.8 172.2 L233.2 170.0 L228.8 168.5 L58.5 169.0 L54.0 171.0 L49.2 175.2 L46.2 180.0 L40.0 197.2 L40.0 198.2 L38.0 202.8 L37.8 204.5 L37.0 205.5 L37.0 206.5 L32.0 219.5 L31.0 223.2 L25.0 239.0 L25.0 240.0 L23.0 244.5 L20.8 252.0 L20.0 253.0 L8.8 285.2 L8.0 286.2 L7.8 288.0 L4.0 297.5 L4.0 298.5 L1.2 305.2 L0.0 309.5 L0.0 315.2 L1.0 319.5 L2.2 322.2 L6.5 326.8 L9.5 328.5 L13.5 329.8 L63.0 329.2 L68.2 327.5 L71.5 325.5 L74.0 323.0 L77.5 318.0 L79.8 313.0 L80.0 311.2 L81.8 307.2 L84.0 300.0 L84.8 299.0 L85.0 297.2 L85.8 296.2 L86.0 294.5 L96.8 265.2 L97.0 263.5 L98.8 259.8 L98.8 258.5 L100.8 254.0 L100.8 253.0 L105.8 240.0 L107.0 235.5 L108.8 231.8 L108.8 230.5 L111.8 223.2 L112.0 221.5 L112.5 221.0 L117.0 207.5 L117.8 206.5 L117.8 205.5 L121.8 194.2 L124.2 190.0 L127.0 187.8 L157.5 187.8 L159.5 188.8 L161.0 190.2 L161.8 192.0 L161.8 195.8 L161.0 198.0 L160.0 199.8 L160.0 200.8 L159.0 202.5 L158.8 204.2 L156.0 210.8 L153.8 217.8 L153.0 218.8 L152.8 220.5 L152.0 221.5 L151.8 223.2 L143.2 245.5 L142.8 247.8 L140.2 253.5 L137.0 264.0 L136.2 272.5 L138.0 279.0 L140.0 282.0 L142.8 284.8 L146.0 286.8 L148.5 287.8 L153.5 288.2 L194.8 288.8 L199.8 288.5 L205.8 286.8 L207.2 285.8 L211.5 281.2 L243.5 193.5 L244.8 186.5 L243.8 181.5Z M265.2 7.2 L263.8 5.2 L259.8 2.0 L253.5 0.0 L205.8 0.2 L200.5 2.2 L194.5 6.8 L189.0 14.0 L185.0 25.0 L185.0 26.0 L184.0 27.8 L180.0 39.8 L179.2 40.8 L178.8 43.2 L176.2 49.2 L176.0 51.0 L175.0 52.8 L161.0 92.5 L159.0 97.0 L159.0 98.2 L158.0 100.0 L151.8 118.2 L149.0 124.8 L149.0 125.8 L147.2 129.8 L146.8 132.2 L146.0 133.2 L146.0 134.2 L143.0 139.5 L139.8 141.8 L111.0 141.8 L108.0 140.8 L106.2 138.8 L105.5 136.2 L105.8 133.0 L107.8 128.5 L108.8 124.8 L109.8 123.0 L113.0 113.2 L114.8 109.5 L118.8 97.8 L119.8 96.0 L124.8 81.5 L125.8 79.8 L125.8 78.8 L130.8 66.0 L131.2 62.5 L131.0 54.8 L130.5 52.5 L128.0 47.8 L123.0 43.2 L120.5 42.0 L115.5 40.8 L67.5 40.8 L65.5 41.0 L62.2 42.2 L60.0 43.8 L57.0 46.8 L55.2 50.0 L36.8 101.2 L33.2 109.8 L32.0 114.2 L31.0 115.8 L30.8 117.5 L30.0 118.5 L29.8 120.2 L24.0 135.0 L23.0 138.5 L23.0 145.5 L25.2 151.0 L29.2 155.0 L34.5 158.5 L37.5 159.8 L44.0 160.8 L209.8 160.8 L212.2 159.8 L216.0 157.0 L220.8 150.5 L228.5 129.2 L228.8 127.5 L229.5 126.5 L231.8 119.2 L232.5 118.2 L247.8 76.2 L249.0 71.8 L250.8 68.0 L252.0 63.5 L266.8 23.8 L267.8 20.2 L267.8 14.8 L266.8 10.2Z"/></svg>';

  /* ---------------- cart store ---------------- */
  var CART_KEY = 'hn_cart_v1';
  var memCart = [];
  var Cart = {
    read: function () {
      try { var raw = localStorage.getItem(CART_KEY); return raw ? S.normaliseLines(JSON.parse(raw)).map(strip) : []; }
      catch (e) { return memCart.slice(); }
    },
    write: function (lines) {
      lines = S.normaliseLines(lines).map(strip);
      memCart = lines;
      try { localStorage.setItem(CART_KEY, JSON.stringify(lines)); } catch (e) { /* private mode */ }
      doc.dispatchEvent(new CustomEvent('cart:change', { detail: lines }));
      return lines;
    },
    add: function (id, size, qty) {
      var lines = Cart.read(), found = false;
      lines.forEach(function (l) { if (l.id === id && l.size === size) { l.qty += qty; found = true; } });
      if (!found) lines.push({ id: id, size: size, qty: qty });
      return Cart.write(lines);
    },
    update: function (index, patch) {
      var lines = Cart.read();
      if (!lines[index]) return lines;
      Object.keys(patch).forEach(function (k) { lines[index][k] = patch[k]; });
      // merge duplicates if size changed into an existing line
      var merged = [];
      lines.forEach(function (l) {
        var m = merged.filter(function (x) { return x.id === l.id && x.size === l.size; })[0];
        if (m) m.qty += l.qty; else merged.push(l);
      });
      return Cart.write(merged);
    },
    remove: function (index) { var lines = Cart.read(); lines.splice(index, 1); return Cart.write(lines); },
    clear: function () { return Cart.write([]); },
    count: function () { return Cart.read().reduce(function (n, l) { return n + l.qty; }, 0); }
  };
  function strip(l) { return { id: l.id, size: l.size, qty: l.qty }; }
  // keep tabs in sync
  window.addEventListener('storage', function (e) { if (e.key === CART_KEY) doc.dispatchEvent(new CustomEvent('cart:change')); });

  /* ---------------- chrome: header, menu, footer ---------------- */
  var page = body.getAttribute('data-page') || '';
  var NAV = [
    { href: 'index.html', label: 'Home', key: 'home' },
    { href: 'shop.html', label: 'Shop', key: 'shop' },
    { href: 'shop.html?filter=new', label: 'New Arrivals', key: 'new' },
    { href: 'about.html', label: 'About Us', key: 'about' },
    { href: 'contact.html', label: 'Contact', key: 'contact' }
  ];
  var isNewFilter = /filter=new/.test(location.search);
  function current(n) {
    if (n.key === 'new') return page === 'shop' && isNewFilter;
    if (n.key === 'shop') return (page === 'shop' && !isNewFilter) || page === 'product';
    return page === n.key;
  }

  function buildChrome() {
    body.insertAdjacentHTML('afterbegin',
      '<a class="skip-link" href="#main">Skip to content</a>' +
      '<div class="grain" aria-hidden="true"></div>' +
      '<div class="announce" role="region" aria-label="Announcement"><div class="marquee" aria-hidden="true">' +
        repeat('<span>Delivery all over Pakistan 🇵🇰</span><span>Get Rs. 150 off on online payments</span><span>Wear your story</span>', 4) +
      '</div><span class="sr-only">Delivery all over Pakistan. Get Rs. 150 off on online payments.</span></div>' +
      '<header class="header" id="header">' +
        '<a class="logo" href="index.html" aria-label="HypeNook — home">' + LOGO_MARK + wordmark('logo__word') + '</a>' +
        '<nav class="nav" aria-label="Primary">' + NAV.map(function (n) {
          return '<a class="link-u" href="' + n.href + '"' + (current(n) ? ' aria-current="page"' : '') + '>' + n.label + '</a>';
        }).join('') + '</nav>' +
        '<div class="header__actions">' +
          '<button class="icon-btn" id="bagBtn" type="button" aria-label="Open shopping bag" aria-controls="drawer" aria-expanded="false">' + ICON.bag + '<span class="bag-count" id="bagCount">0</span></button>' +
          '<button class="icon-btn menu-toggle" id="menuBtn" type="button" aria-label="Open menu" aria-controls="mobileMenu" aria-expanded="false"><span class="burger"><span></span><span></span></span></button>' +
        '</div>' +
      '</header>' +
      '<div class="mobile-menu" id="mobileMenu" aria-hidden="true">' +
        '<nav aria-label="Mobile">' + NAV.map(function (n) { return '<a href="' + n.href + '"><span>' + n.label + '</span></a>'; }).join('') + '</nav>' +
        '<div class="mobile-menu__foot"><span>' + B.tagline + '</span><span><a href="' + B.instagram + '" target="_blank" rel="noopener">Instagram</a> · <a href="' + B.facebook + '" target="_blank" rel="noopener">Facebook</a> · <a href="' + B.whatsappUrl + '" target="_blank" rel="noopener">WhatsApp</a></span></div>' +
      '</div>'
    );

    body.insertAdjacentHTML('beforeend',
      '<footer class="footer">' +
        '<div class="footer__top">' +
          '<div><a class="logo" href="index.html">' + LOGO_MARK + wordmark('logo__word') + '</a>' +
            '<p class="footer__tag">Wear your story.</p>' +
            '<p class="footer__desc">' + B.description + '. Delivery all over Pakistan 🇵🇰</p>' +
            '<div class="socials">' +
              '<a href="' + B.instagram + '" target="_blank" rel="noopener" aria-label="HypeNook on Instagram">' + ICON.ig + '</a>' +
              '<a href="' + B.facebook + '" target="_blank" rel="noopener" aria-label="HypeNook on Facebook">' + ICON.fb + '</a>' +
              '<a href="' + B.whatsappUrl + '" target="_blank" rel="noopener" aria-label="Chat with HypeNook on WhatsApp">' + ICON.wa + '</a>' +
            '</div></div>' +
          '<div><h4>Shop</h4><ul><li><a class="link-u" href="shop.html">All products</a></li><li><a class="link-u" href="shop.html?filter=new">New arrivals</a></li><li><a class="link-u" href="product.html?id=noir-graphic-oversized-hoodie">NOIR Hoodie</a></li><li><a class="link-u" href="checkout.html">Checkout</a></li></ul></div>' +
          '<div><h4>Help</h4><ul><li><a class="link-u" href="contact.html">Contact</a></li><li><a class="link-u" href="returns.html">Return &amp; Exchange</a></li><li><a class="link-u" href="privacy.html">Privacy Policy</a></li><li><a class="link-u" href="terms.html">Terms &amp; Conditions</a></li></ul></div>' +
          '<div><h4>Contact</h4><ul>' +
            '<li><a class="link-u" href="tel:' + B.phoneRaw + '">' + B.phoneDisplay + '</a></li>' +
            '<li><a class="link-u" href="' + B.whatsappUrl + '" target="_blank" rel="noopener">WhatsApp us</a></li>' +
            '<li><a class="link-u" href="mailto:' + B.email + '">' + B.email + '</a></li>' +
            '<li style="color:var(--muted)">Delivery all over Pakistan — ' + S.formatPKR(S.PRICING.deliveryFee) + ' flat</li>' +
          '</ul></div>' +
        '</div>' +
        '<div class="footer__big" aria-hidden="true">' + wordmark('footer__wm', true) + '</div>' +
        '<div class="footer__bottom"><span>© ' + new Date().getFullYear() + ' HypeNook. All rights reserved.</span><span>Wear your story.</span></div>' +
      '</footer>' +
      '<a class="wa-float" href="' + S.whatsappLink('Hi HypeNook! I have a question about an order.') + '" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">' + ICON.wa + '<span class="wa-float__tip">Order on WhatsApp</span></a>' +
      '<div class="drawer-scrim" id="drawerScrim"></div>' +
      '<aside class="drawer" id="drawer" role="dialog" aria-modal="true" aria-labelledby="drawerTitle" aria-hidden="true" tabindex="-1">' +
        '<div class="drawer__head"><h2 id="drawerTitle">Your bag <span id="drawerCount"></span></h2><button class="icon-btn" id="drawerClose" type="button" aria-label="Close bag">' + ICON.close + '</button></div>' +
        '<div class="drawer__body" id="drawerBody"></div>' +
        '<div class="drawer__foot" id="drawerFoot"></div>' +
      '</aside>' +
      '<div class="toast" id="toast" role="status" aria-live="polite"></div>' +
      '<div class="curtain" id="curtain" aria-hidden="true"></div>'
    );
  }
  function repeat(s, n) { var o = ''; for (var i = 0; i < n; i++) o += s; return o; }

  /* ---------------- header behaviour ---------------- */
  function initHeader() {
    var header = $('#header'), lastY = window.scrollY, ticking = false;
    function onScroll() {
      var y = window.scrollY;
      header.classList.toggle('is-scrolled', y > 40);
      var menuOpen = body.classList.contains('menu-open');
      header.classList.toggle('is-hidden', !menuOpen && y > 400 && y > lastY + 4);
      if (y < lastY - 4 || y < 400) header.classList.remove('is-hidden');
      lastY = y; ticking = false;
    }
    window.addEventListener('scroll', function () { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });
    onScroll();

    var menuBtn = $('#menuBtn'), menu = $('#mobileMenu');
    function setMenu(open) {
      body.classList.toggle('menu-open', open);
      body.classList.toggle('is-locked', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.setAttribute('aria-hidden', String(!open));
      header.classList.remove('is-hidden');
    }
    menuBtn.addEventListener('click', function () { setMenu(!body.classList.contains('menu-open')); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && body.classList.contains('menu-open')) setMenu(false); });
    $$('#mobileMenu a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  }

  /* ---------------- cart drawer ---------------- */
  var lastFocus = null;
  function openCart() {
    lastFocus = doc.activeElement;
    renderDrawer();
    body.classList.add('cart-open', 'is-locked');
    $('#drawer').setAttribute('aria-hidden', 'false');
    $('#bagBtn').setAttribute('aria-expanded', 'true');
    setTimeout(function () { $('#drawerClose').focus(); }, 50);
  }
  function closeCart() {
    body.classList.remove('cart-open');
    if (!body.classList.contains('menu-open')) body.classList.remove('is-locked');
    $('#drawer').setAttribute('aria-hidden', 'true');
    $('#bagBtn').setAttribute('aria-expanded', 'false');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function totalsHTML(t, opts) {
    opts = opts || {};
    var online = S.computeTotals(t.items, 'online');
    var h = '<div class="totals">' +
      '<div><span class="muted">Subtotal (' + t.itemCount + (t.itemCount === 1 ? ' item' : ' items') + ')</span><span>' + S.formatPKR(t.subtotal) + '</span></div>' +
      '<div><span class="muted">Delivery</span><span>' + S.formatPKR(t.delivery) + '</span></div>';
    if (opts.showMethod) {
      h += t.discount
        ? '<div class="discount"><span>Online payment discount</span><span>-' + S.formatPKR(t.discount) + '</span></div>'
        : '<div><span class="muted">Discount <small>(online payments only)</small></span><span>' + S.formatPKR(0) + '</span></div>';
      h += '<div class="grand"><span>Total</span><span>' + S.formatPKR(t.total) + '</span></div>';
    } else {
      h += '<div class="grand"><span>Total · Cash on Delivery</span><span>' + S.formatPKR(t.total) + '</span></div>' +
        '<div class="discount"><span>Total · Online payment (−' + S.formatPKR(S.PRICING.onlineDiscount) + ')</span><span>' + S.formatPKR(online.total) + '</span></div>';
    }
    return h + '</div>';
  }

  function renderDrawer() {
    var lines = Cart.read();
    var t = S.computeTotals(lines, 'cod');
    var bodyEl = $('#drawerBody'), foot = $('#drawerFoot');
    $('#drawerCount').textContent = t.itemCount ? '(' + t.itemCount + ')' : '';
    if (!lines.length) {
      bodyEl.innerHTML = '<div class="empty"><p class="display">Your bag is empty</p><p>Start your story with the NOIR drop.</p></div>';
      foot.innerHTML = '<a class="btn btn--block" href="shop.html"><span class="btn__label">Shop the collection</span>' + ICON.arrow + '</a>';
      return;
    }
    bodyEl.innerHTML = t.items.map(function (l, i) {
      var p = S.getProduct(l.id);
      return '<div class="line-item" data-i="' + i + '">' +
        '<a href="product.html?id=' + p.id + '"><img src="' + img(p.images[0].key, true) + '" alt="' + esc(p.name) + '" width="84" height="92" loading="lazy"></a>' +
        '<div><div class="line-item__top"><p class="line-item__name">' + esc(p.name) + '</p><span>' + S.formatPKR(l.lineTotal) + '</span></div>' +
        '<div style="color:var(--muted);font-size:13px">' + S.formatPKR(l.unitPrice) + ' each</div>' +
        '<div class="line-item__controls">' +
          '<label class="sr-only" for="sz' + i + '">Size</label><select class="mini-select" id="sz' + i + '" data-act="size">' +
            p.sizes.map(function (s) { return '<option' + (s === l.size ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
          '<div class="qty" role="group" aria-label="Quantity"><button type="button" data-act="dec" aria-label="Decrease quantity">−</button><output aria-live="polite">' + l.qty + '</output><button type="button" data-act="inc" aria-label="Increase quantity"' + (l.qty >= S.PRICING.maxQtyPerLine ? ' disabled' : '') + '>+</button></div>' +
          '<button type="button" class="remove" data-act="remove">Remove</button>' +
        '</div></div></div>';
    }).join('');
    foot.innerHTML = '<div class="drawer__promo">Get Rs. 150 off on online payments</div>' + totalsHTML(t) +
      '<div class="drawer__actions"><a class="btn btn--block" href="checkout.html"><span class="btn__label">Checkout</span>' + ICON.arrow + '</a>' +
      '<a class="btn btn--ghost btn--block" target="_blank" rel="noopener" href="' + S.whatsappLink(S.whatsappOrderText(t)) + '"><span class="btn__label">Order via WhatsApp</span></a></div>';
  }

  function initDrawer() {
    $('#bagBtn').addEventListener('click', openCart);
    $('#drawerClose').addEventListener('click', closeCart);
    $('#drawerScrim').addEventListener('click', closeCart);
    doc.addEventListener('keydown', function (e) {
      if (!body.classList.contains('cart-open')) return;
      if (e.key === 'Escape') closeCart();
      if (e.key === 'Tab') trapFocus(e, $('#drawer'));
    });
    $('#drawerBody').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b || b.tagName === 'SELECT') return;
      var i = +b.closest('.line-item').getAttribute('data-i');
      var line = Cart.read()[i]; if (!line) return;
      var act = b.getAttribute('data-act');
      if (act === 'inc') Cart.update(i, { qty: Math.min(line.qty + 1, S.PRICING.maxQtyPerLine) });
      if (act === 'dec') { if (line.qty <= 1) Cart.remove(i); else Cart.update(i, { qty: line.qty - 1 }); }
      if (act === 'remove') Cart.remove(i);
    });
    $('#drawerBody').addEventListener('change', function (e) {
      if (e.target.getAttribute('data-act') !== 'size') return;
      var i = +e.target.closest('.line-item').getAttribute('data-i');
      Cart.update(i, { size: e.target.value });
    });
    doc.addEventListener('cart:change', function () {
      updateCount();
      if (body.classList.contains('cart-open')) {
        var focusedAct = doc.activeElement && doc.activeElement.getAttribute && doc.activeElement.getAttribute('data-act');
        var li = doc.activeElement && doc.activeElement.closest && doc.activeElement.closest('.line-item');
        var idx = li ? li.getAttribute('data-i') : null;
        renderDrawer();
        if (focusedAct && idx != null) { var f = $('.line-item[data-i="' + idx + '"] [data-act="' + focusedAct + '"]'); if (f) f.focus(); else $('#drawerClose').focus(); }
      }
    });
    updateCount();
  }
  function trapFocus(e, container) {
    var f = $$('a[href], button:not([disabled]), select, input, textarea, [tabindex]:not([tabindex="-1"])', container).filter(function (x) { return x.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function updateCount() {
    var n = Cart.count(), c = $('#bagCount');
    c.textContent = n > 99 ? '99+' : n;
    c.classList.toggle('has-items', n > 0);
    $('#bagBtn').setAttribute('aria-label', 'Open shopping bag, ' + n + (n === 1 ? ' item' : ' items'));
  }

  /* ---------------- add to cart with fly animation ---------------- */
  function addToCart(id, size, qty, sourceImg) {
    Cart.add(id, size, qty);
    var p = S.getProduct(id);
    var bag = $('#bagBtn');
    var done = function () {
      bag.classList.remove('bump'); void bag.offsetWidth; bag.classList.add('bump');
      toast('Added to bag — ' + p.shortName + ' · Size ' + size + ' × ' + qty);
    };
    if (!sourceImg || reduceMotion) { done(); return; }
    var r = sourceImg.getBoundingClientRect(), br = bag.getBoundingClientRect();
    var f = el('img', { class: 'fly', src: sourceImg.currentSrc || sourceImg.src, alt: '' });
    var w = Math.min(r.width, 220), h = w * (r.height / r.width);
    f.style.cssText = 'left:' + (r.left + (r.width - w) / 2) + 'px;top:' + (r.top + (r.height - h) / 2) + 'px;width:' + w + 'px;height:' + h + 'px';
    body.appendChild(f);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var dx = br.left + br.width / 2 - (r.left + r.width / 2), dy = br.top + br.height / 2 - (r.top + r.height / 2);
        f.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(.08) rotate(-12deg)';
        f.style.opacity = '.4'; f.style.borderRadius = '50%';
      });
    });
    setTimeout(function () { f.remove(); done(); }, 900);
  }

  var toastTimer;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('is-on');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, 2800);
  }

  /* ---------------- loader & page transitions ---------------- */
  function initLoader() {
    var firstVisit = true;
    try { firstVisit = !sessionStorage.getItem('hn_seen'); sessionStorage.setItem('hn_seen', '1'); } catch (e) {}
    var curtain = $('#curtain');
    var finish = function () { body.classList.add('is-loaded'); doc.dispatchEvent(new Event('hn:ready')); };

    if (firstVisit && !reduceMotion && page === 'home') {
      var loader = el('div', { class: 'loader', 'aria-hidden': 'true' },
        '<div class="loader__inner">' + LOGO_MARK.replace('logo__mark', 'loader__mark') + '' + wordmark('loader__word') + '<span class="loader__sub">Wear your story</span><div class="loader__bar"></div></div>');
      body.appendChild(loader); body.classList.add('is-locked');
      var minTime = new Promise(function (r) { setTimeout(r, 1500); });
      var heroImg = $('.hero__media img');
      var imgReady = heroImg && !heroImg.complete ? new Promise(function (r) { heroImg.addEventListener('load', r); heroImg.addEventListener('error', r); setTimeout(r, 4000); }) : Promise.resolve();
      Promise.all([minTime, imgReady]).then(function () {
        loader.classList.add('is-done'); body.classList.remove('is-locked');
        setTimeout(finish, 350);
        setTimeout(function () { loader.remove(); }, 1300);
      });
    } else if (!reduceMotion) {
      // arriving from an internal link: curtain lifts away
      curtain.classList.add('is-in'); curtain.style.transition = 'none';
      requestAnimationFrame(function () {
        curtain.style.transition = ''; curtain.classList.remove('is-in'); curtain.classList.add('is-out');
        setTimeout(function () { curtain.classList.remove('is-out'); }, 900);
        setTimeout(finish, 150);
      });
    } else finish();

    // intercept internal navigation
    doc.addEventListener('click', function (e) {
      var a = e.target.closest('a'); if (!a || reduceMotion) return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      if (a.target && a.target !== '_self') return;
      if (a.hasAttribute('download')) return;
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#' || /^(mailto:|tel:|https?:|javascript:)/i.test(href)) return;
      var url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
      e.preventDefault();
      curtain.classList.remove('is-out'); curtain.classList.add('is-in');
      setTimeout(function () { location.href = url.href; }, 650);
    });
    window.addEventListener('pageshow', function (e) { if (e.persisted) { curtain.classList.remove('is-in', 'is-out'); body.classList.remove('is-locked', 'cart-open', 'menu-open'); } });
  }

  /* ---------------- scroll reveals & parallax ---------------- */
  function splitLines() {
    $$('[data-split]').forEach(function (n) {
      if (n.getAttribute('data-split-done')) return;
      var parts = n.innerHTML.split(/<br\s*\/?>/i);
      n.innerHTML = parts.map(function (p, i) {
        return '<span class="split-line"><span style="transition-delay:' + (0.08 * i + (parseFloat(n.getAttribute('data-delay')) || 0)) + 's">' + p.trim() + '</span></span>';
      }).join('');
      n.setAttribute('data-split-done', '1');
    });
  }
  function initReveal() {
    splitLines();
    var targets = $$('[data-reveal], [data-split], .mask');
    if (reduceMotion || !('IntersectionObserver' in window)) { targets.forEach(function (t) { t.classList.add('is-revealed'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var t = en.target, d = parseFloat(t.getAttribute('data-delay')) || 0;
        if (t.hasAttribute('data-reveal')) t.style.transitionDelay = d + 's';
        t.classList.add('is-revealed'); io.unobserve(t);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    var start = function () { targets.forEach(function (t) { if (!t.hasAttribute('data-hero')) io.observe(t); }); };
    // hero items wait for the loader
    var heroItems = $$('[data-hero]');
    doc.addEventListener('hn:ready', function () { heroItems.forEach(function (t) { t.classList.add('is-revealed'); }); });
    if (body.classList.contains('is-loaded')) heroItems.forEach(function (t) { t.classList.add('is-revealed'); });
    start();
  }
  function initParallax() {
    if (reduceMotion) return;
    var items = $$('[data-parallax]'); if (!items.length) return;
    var vh = window.innerHeight, running = false;
    var cur = items.map(function () { return 0; });
    function frame() {
      var still = true;
      items.forEach(function (n, i) {
        var r = n.parentElement.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        var speed = parseFloat(n.getAttribute('data-parallax')) || 0.15;
        var target = (r.top + r.height / 2 - vh / 2) * -speed;
        cur[i] += (target - cur[i]) * 0.12;            // eased (lerp) for smoothness
        if (Math.abs(target - cur[i]) > 0.1) still = false;
        n.style.transform = 'translate3d(0,' + cur[i].toFixed(2) + 'px,0)';
      });
      if (!still) requestAnimationFrame(frame); else running = false;
    }
    function kick() { if (!running) { running = true; requestAnimationFrame(frame); } }
    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', function () { vh = window.innerHeight; kick(); });
    kick();
  }

  /* ---------------- modal ---------------- */
  function openModal(id) {
    var m = doc.getElementById(id); if (!m) return;
    var prev = doc.activeElement;
    m.classList.add('is-open'); m.setAttribute('aria-hidden', 'false'); body.classList.add('is-locked');
    var panel = $('.modal__panel', m); panel.focus();
    function close() {
      m.classList.remove('is-open'); m.setAttribute('aria-hidden', 'true'); body.classList.remove('is-locked');
      doc.removeEventListener('keydown', key); if (prev) prev.focus();
    }
    function key(e) { if (e.key === 'Escape') close(); if (e.key === 'Tab') trapFocus(e, panel); }
    doc.addEventListener('keydown', key);
    $$('[data-close]', m).forEach(function (b) { b.onclick = close; });
  }

  /* ---------------- bank transfer details (checkout + confirmation) ---------------- */
  function bankBox(amount) {
    var K = S.BANK;
    var row = function (label, shown, copy) {
      return '<div class="bank__row"><span class="bank__label">' + label + '</span><span class="bank__val">' + esc(shown) + '</span>' +
        (copy ? '<button type="button" class="bank__copy" data-copy="' + esc(copy) + '" aria-label="Copy ' + label + '">Copy</button>' : '<span></span>') + '</div>';
    };
    return '<div class="bank" role="group" aria-label="Bank transfer details">' +
      row('Bank', K.bank) +
      row('Account title', K.accountTitle, K.accountTitle) +
      row('IBAN', S.formatIBAN(K.iban), K.iban) +
      (amount != null ? row('Amount', S.formatPKR(amount), String(amount)) : '') +
    '</div>';
  }
  doc.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]'); if (!b) return;
    var text = b.getAttribute('data-copy');
    var done = function () { b.textContent = 'Copied'; toast('Copied: ' + text); setTimeout(function () { b.textContent = 'Copy'; }, 1800); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
      else fallback();
    } catch (x) { fallback(); }
    function fallback() {
      var ta = el('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; body.appendChild(ta); ta.select();
      try { doc.execCommand('copy'); done(); } catch (y) { toast('Select and copy: ' + text); }
      ta.remove();
    }
  });

  /* ---------------- product card (shared by home + shop) ---------------- */
  function productCard(p, i) {
    return '<article class="card" data-reveal data-delay="' + (0.08 * (i || 0)) + '">' +
      '<a class="card__media" href="product.html?id=' + p.id + '" aria-label="' + esc(p.name) + ' — ' + S.formatPKR(p.price) + '">' +
        (p.isNew ? '<span class="card__badge">New drop</span>' : '') +
        '<img src="' + img(p.images[0].key, true) + '" alt="' + esc(p.images[0].alt) + '" width="800" height="875" loading="lazy">' +
        '<img class="alt" src="' + img(p.images[2].key, true) + '" alt="" width="800" height="875" loading="lazy" aria-hidden="true">' +
      '</a>' +
      '<div class="card__quick" role="group" aria-label="Quick add ' + esc(p.shortName) + '">' +
        p.sizes.map(function (s) { return '<button type="button" data-quick="' + p.id + '" data-size="' + s + '" aria-label="Add size ' + s + ' to bag">' + s + '</button>'; }).join('') +
      '</div>' +
      '<div class="card__info"><div><h3 class="card__name"><a href="product.html?id=' + p.id + '">' + esc(p.name) + '</a></h3><div class="card__sub">' + esc(p.colour) + ' · Sizes ' + p.sizes.join(' / ') + '</div></div>' +
      '<div class="card__price">' + S.formatPKR(p.price) + '</div></div>' +
    '</article>';
  }
  doc.addEventListener('click', function (e) {
    var b = e.target.closest('[data-quick]'); if (!b) return;
    var card = b.closest('.card');
    addToCart(b.getAttribute('data-quick'), b.getAttribute('data-size'), 1, card && $('.card__media img', card));
  });

  /* ---------------- boot ---------------- */
  buildChrome();
  initHeader();
  initDrawer();
  initLoader();

  window.HN = {
    $: $, $$: $$, el: el, esc: esc, img: img, ICON: ICON,
    Cart: Cart, addToCart: addToCart, openCart: openCart, toast: toast,
    totalsHTML: totalsHTML, productCard: productCard, openModal: openModal, bankBox: bankBox,
    initReveal: initReveal, reduceMotion: reduceMotion
  };

  // page scripts run after this file; reveal/parallax start once they've rendered
  doc.addEventListener('DOMContentLoaded', function () { initReveal(); initParallax(); });
})();
