# HypeNook — Wear Your Story

Premium streetwear store for **HypeNook**. It has a static front end (HTML, CSS and vanilla JS, with no build step) and three small serverless API functions.

```
index.html  shop.html  product.html  checkout.html  order.html
about.html  contact.html  privacy.html  terms.html  returns.html  404.html
assets/css/style.css        design system + all animations
assets/js/store.js          catalog, prices, pricing rules, validation (shared by browser AND server)
assets/js/site.js           header, footer, mobile menu, cart, cart drawer, loader,
                            page transitions, scroll reveals, parallax, add-to-cart animation
assets/js/home.js | shop.js | product.js | checkout.js | order.js | reviews.js
assets/data/reviews.json    approved customer reviews (starts empty)
assets/img/                 your product photos (WebP + JPG fallback, plus og-image.jpg)
api/order.js                POST: validates, re-prices from the catalog, saves the order
api/review.js               POST: saves a customer review as "pending" (Supabase)
api/reviews.js              GET: approved reviews only (public)
api/admin/reviews.js        GET/POST: list, approve, delete reviews (needs ADMIN_PASSWORD)
admin.html                  password-protected review moderation page
supabase/reviews.sql        SQL that creates the reviews table (RLS on)
api/payment/status.js       GET: is online payment configured?
api/payment/webhook.js      POST: verified payment notifications from the gateway
lib/                        server helpers (http, order storage, Supabase, payment adapter)
scripts/dev-server.js       local dev server (NOT used on Vercel)
.vercelignore               keeps local-only files out of the Vercel deployment
tests/pricing.test.js       pricing + validation tests
```

## Run locally

```bash
npm run dev             # http://localhost:3000   (Node 18+)  = node scripts/dev-server.js
npm test                # pricing tests
```

## Pricing (single source of truth: `assets/js/store.js`)

| | Cash on Delivery | Online payment |
|---|---|---|
| NOIR Hoodie | Rs. 2,750 | Rs. 2,750 |
| Delivery | Rs. 299 | Rs. 299 |
| Discount | — | −Rs. 150 |
| **Total** | **Rs. 3,049** | **Rs. 2,899** |

Delivery (Rs. 299) and the online discount (Rs. 150) apply **once per order**, not per item.
The server ignores any price the browser sends and recalculates everything from `store.js`.

To change a price, product text or sizes, edit `PRODUCTS` / `PRICING` in `assets/js/store.js`.
To show a measurement table in the size guide, fill in `sizeChart` there.

## Environment variables (server only; see `.env.example`)

| Variable | Needed for |
|---|---|
| `SITE_URL` | Payment return URLs, e.g. `https://www.hypenook.shop` |
| `ORDER_WEBHOOK_URL` | Where new orders are sent (see below) |
| `ORDER_WEBHOOK_SECRET` | Sent as the `X-HypeNook-Secret` header so your receiver can verify orders |
| `PAYMENT_PROVIDER` + provider keys | Optional: automatic card/wallet gateway (online payment works by bank transfer without it) |

No secrets are used in the front-end files.

## Receiving orders

Every order is POSTed as JSON to `ORDER_WEBHOOK_URL`:
`{ "event": "order.created", "order": { orderNumber, createdAt, status, paymentMethod, customer, totals } }`

**Until `ORDER_WEBHOOK_URL` is set**, the site does *not* claim to have received an order. The confirmation page says
"Action needed — not sent yet" and asks the customer to tap **Send order on WhatsApp**, which opens a chat with
0336 8807765 containing the full order (items, sizes, totals, name, phone, address). Their bag is kept until then.

### Easiest option: Google Sheet + Apps Script (free)
1. Create a Google Sheet and open **Extensions → Apps Script**.
2. Paste the script below, set `SECRET` to the same value as `ORDER_WEBHOOK_SECRET`, and save.
3. Click **Deploy → New deployment → Web app**. Set "Execute as: Me" and "Who has access: Anyone". Copy the URL into `ORDER_WEBHOOK_URL`.

```js
const SECRET = 'change-me-to-a-long-random-string';
function doPost(e) {
  // Apps Script cannot read request headers, so also send the secret as ?key= in the URL:
  // ORDER_WEBHOOK_URL=https://script.google.com/macros/s/XXXX/exec?key=YOUR_SECRET
  if (e.parameter.key !== SECRET) return ContentService.createTextOutput('forbidden');
  const { event, order } = JSON.parse(e.postData.contents);
  const sh = SpreadsheetApp.getActive().getSheets()[0];
  const c = order.customer || {}, t = order.totals || {};
  sh.appendRow([new Date(), event, order.orderNumber, order.status, order.paymentMethod,
    c.name, c.phone, c.email, c.address, c.city, c.province, c.postalCode, c.notes,
    (t.items || []).map(i => `${i.name} ${i.size} x${i.qty}`).join(', '),
    t.subtotal, t.delivery, t.discount, t.total]);
  return ContentService.createTextOutput('ok');
}
```
Zapier, Make or your own API work the same way. Any non-2xx response is treated as a failure, and the customer
is shown an error instead of a confirmation.

## Online payments: bank transfer (live), card gateway optional

**Online payment is active as a direct bank transfer.** The account is set in `assets/js/store.js` → `BANK`:
account title, bank and IBAN. These are shown to customers, so they are not secrets.

How it works:
1. The customer chooses **Online payment — bank transfer**, and Rs. 150 off is applied automatically.
2. Checkout shows the account title, bank and IBAN (with Copy buttons) and the exact amount.
3. The order is saved with status `awaiting_payment` and `payment.method = "bank_transfer"`.
4. The confirmation page shows the bank details again and a **Send payment screenshot** button. It opens WhatsApp
   with the order number and amount filled in.
5. **You** check that the money arrived in your account, then confirm and dispatch. The site never marks a bank
   transfer as paid by itself.

If the order server can't be reached (static hosting, or `ORDER_WEBHOOK_URL` not set), the customer is asked to send
the order *and* the payment screenshot on WhatsApp.

To change the account, edit `BANK` in `store.js`. The change applies to both the browser and the server.

### Optional: automatic card/wallet payments
If you later open a merchant account with a gateway (Safepay, PayFast/APPS, JazzCash, Easypaisa), implement
`createCheckout()` / `verifyWebhook()` in `lib/payments.js` and set `PAYMENT_PROVIDER` plus that provider's keys.
Online payment then switches from bank transfer to the gateway's secure payment page, and payments are confirmed
automatically through `/api/payment/webhook`.

## Reviews (real customers only)

The site shows **only reviews you approve**. Nothing is published automatically, and there are no sample reviews.

- **Where they show:** the product page (star summary, rating breakdown and review cards, plus a rating line under the
  product name) and a home-page "Their stories" section below "Follow the hype". The home section shows the latest 3 reviews.
  Until the first review is approved, both say "No reviews yet" and offer a **Write a review** button.
- **How customers send one:** the **Write a review** button opens a form (stars, name, city, headline, review, size, order number).
  - With Supabase set up (below), it is saved in the `reviews` table as `pending`.
  - Without Supabase but with `ORDER_WEBHOOK_URL`, it arrives at your webhook as `{ "event": "review.submitted", "data": { …, "status": "pending" } }`.
  - With neither, the customer is asked to send the review to you on WhatsApp.
- **Approving one (Supabase):** open `https://your-site/admin.html`, log in with `ADMIN_PASSWORD`, and click **Approve** or
  **Delete**. Approved reviews show on the site within about a minute.
- **Photos:** customers can add up to 3 photos (JPG/PNG/WEBP, max 5 MB). The browser shrinks them to max 1600px WEBP,
  then uploads them straight to the private Supabase Storage bucket `review-photos` using one-time signed URLs that the
  server only issues for a valid review. You see them on `/admin.html`; the site only shows photos of approved reviews.
  Deleting a review also deletes its photos.
- **Spam protection:** hidden honeypot field, required fields with length limits (name 2–60, review 10–1000 characters),
  links are rejected, duplicate reviews are ignored, and each visitor can send at most 3 reviews per day.

### Supabase setup
1. Supabase → **SQL Editor** → paste `supabase/reviews.sql` → **Run**. This creates the table with Row Level Security on
   and no public access. Only the site's server functions can read or write it.
2. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (the secret key, never the public anon key) and `ADMIN_PASSWORD`
   as server environment variables (Vercel → Settings → Environment Variables), then redeploy.

- **Approving one by hand (no Supabase):** add it to `assets/data/reviews.json` and redeploy. These are shown alongside Supabase reviews:

```json
{
  "reviews": [
    {
      "productId": "noir-graphic-oversized-hoodie",
      "name": "Customer's name (with their permission)",
      "city": "Lahore",
      "rating": 5,
      "title": "Optional headline",
      "text": "Exactly what the customer wrote.",
      "size": "L",
      "date": "2026-11-20",
      "verified": true
    }
  ]
}
```

Set `"verified": true` only if you've matched the review to a real order. You can also add reviews customers have sent
you on Instagram or WhatsApp. Use their words, and ask their permission first.

In the Google Sheet script, reviews arrive with `event = "review.submitted"`. To keep them on their own tab, add this
at the top of `doPost`, after the secret check:

```js
const body = JSON.parse(e.postData.contents);
if (body.event === 'review.submitted') {
  const r = body.data;
  SpreadsheetApp.getActive().getSheetByName('Reviews')
    .appendRow([new Date(), r.productId, r.rating, r.name, r.city, r.title, r.text, r.size, r.orderNumber]);
  return ContentService.createTextOutput('ok');
}
```

## Deploy

**Vercel (recommended; static site + API functions, free tier):**
1. Push this folder to a GitHub repo, then go to vercel.com → **Add New Project** → import the repo. Framework preset: **Other**. No build command.
2. Add the environment variables under **Settings → Environment Variables** and redeploy.
3. Add your domain under **Settings → Domains**.

**Netlify:** static pages work as-is. The `/api` functions would need to be moved to `netlify/functions` with a redirect.
Without them, COD orders still work through the WhatsApp confirmation step.

**Any Node host (Render, Railway, VPS):** `node scripts/dev-server.js` (uses `PORT`, reads `.env`).

**Static-only hosting** (GitHub Pages, cPanel): everything works except server order storage and online payment.
COD orders complete via WhatsApp.

After deploying, replace `https://www.hypenook.shop` in `robots.txt` and `sitemap.xml` with your real domain.

## Notes
- Fonts load from Google Fonts (Archivo, Instrument Serif, Inter). System fonts are used if they're unavailable.
- Animations are hand-written (CSS + IntersectionObserver + requestAnimationFrame) with no animation library, so pages stay light.
  Everything respects `prefers-reduced-motion`.
- The cart is stored in the customer's browser (`localStorage`), so it survives refreshes.
