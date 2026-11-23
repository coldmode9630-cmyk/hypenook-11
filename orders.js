'use strict';
/**
 * Order persistence.
 * Orders are POSTed as JSON to ORDER_WEBHOOK_URL (e.g. a Google Apps Script
 * that appends a row to a Google Sheet, a Make/Zapier hook, or your own API).
 * The request carries header `X-HypeNook-Secret: ORDER_WEBHOOK_SECRET` so the
 * receiver can reject anything that didn't come from this site.
 * See README → "Receiving orders".
 */
async function saveOrder(order, event) {
  var url = process.env.ORDER_WEBHOOK_URL;
  if (!url) return { stored: false, reason: 'not_configured' };
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, 10000);
  try {
    var r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-HypeNook-Secret': process.env.ORDER_WEBHOOK_SECRET || '' },
      body: JSON.stringify({ event: event || 'order.created', order: order }),
      signal: ctrl.signal,
      redirect: 'follow'
    });
    if (!r.ok) throw new Error('Order webhook responded ' + r.status);
    return { stored: true };
  } finally { clearTimeout(timer); }
}
/** Send any other event (e.g. review.submitted) to the same webhook. */
async function postEvent(event, data) {
  var url = process.env.ORDER_WEBHOOK_URL;
  if (!url) return { stored: false, reason: 'not_configured' };
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, 10000);
  try {
    var r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-HypeNook-Secret': process.env.ORDER_WEBHOOK_SECRET || '' },
      body: JSON.stringify({ event: event, data: data }),
      signal: ctrl.signal, redirect: 'follow'
    });
    if (!r.ok) throw new Error('Webhook responded ' + r.status);
    return { stored: true };
  } finally { clearTimeout(timer); }
}

module.exports = { saveOrder: saveOrder, postEvent: postEvent };
