# Brenda's Homestead Kitchen

Country-style cottage food website for **Brenda Shoemaker** in **McArthur, Ohio**, built for Ohio cottage food sales.

## What this site includes

### Public site
- Warm farmhouse-style homepage
- Products page with prices, photos, stock hints, Foods/Soap filters
- Order page embeds Brenda’s **Google Form** (editable links in Admin). Built-in form is the fallback until the Google link is saved.

### Admin hub (`/admin/`)
Default login:
- **Username:** `Brenda`
- **Password:** `HomesteadKitchen`

Change these under **Settings** after first login.

Admin tools:
- Learning hub for Ohio cottage food + soap basics
- **Google Order Form** tab: paste embed/edit links, live preview, starter question checklist
- How-to guide for using the site
- Product editor (category Foods/Soap/Other, name, price, qty, ingredients, photo)
- Manual order entry for farmers-market / phone orders + CSV export
- Tax & expense tracker with CSV export
- Business settings (payment handles, about text, pickup notes)
- Backup / restore of all data

### Google Form setup (about 2 minutes)
1. Admin → **Google Order Form** → Create new Google Form
2. Copy the starter questions listed on that page
3. In Google Forms: Responses → email notifications on; optional Link to Sheets
4. Send → copy Link (full `docs.google.com/forms/.../viewform` URL)
5. Paste into Admin and Save — it embeds on `/order.html` and in the admin preview
6. Keep the `/edit` link in the Edit field so Brenda can change questions anytime

## End-to-end tests

Live smoke suite (Playwright) against GitHub Pages:

```bash
cd C:\Projects\brenda-cottage
node e2e/run-live.js
```

Optional base URL (local preview):

```bash
node e2e/run-live.js http://localhost:5173
```

Needs `playwright` installed once in this folder (`npm install playwright`). The suite uses a fresh browser profile, so it does not touch Brenda’s real admin data.

## Important: taxes

Yes — cottage food income is still taxable.

Ohio cottage law mainly covers licensing/inspection for approved shelf-stable foods. It does **not** erase income tax. Brenda should report profit (Schedule C as a sole proprietor is common) and keep records. This site’s tax tab helps organize sales and expenses for tax time.

## Important: where data lives

**Products, expenses, and Brenda’s admin records** are stored in browser **localStorage** on the device she uses for admin.

That means:
- Easy and free to host
- Use the **same browser/device** for admin work when editing products/expenses
- Click **Download backup** often (Settings)

**Website orders (recommended):** use the **Google Order Form**. Replies go to Brenda’s Google account (email + optional Sheets). Enter paid/fulfilled sales in Admin → Orders as manual orders when you want stock/tax totals updated.

**Fallback:** if no Google Form link is saved, the built-in order form is used (and can also post to Netlify Form `cottage-order` when hosted on Netlify).

## Best free hosting options

| Host | Why it fits | Notes |
| --- | --- | --- |
| **Netlify** (recommended) | Drag-and-drop or Git deploy, free HTTPS, custom domain | You already use Netlify for Shoemaker Consolidated |
| **Cloudflare Pages** | Generous free tier, fast CDN | Great alternative |
| **GitHub Pages** | Free static hosting from a repo | Slightly less beginner-friendly for forms later |
| **Vercel** | Free static hosting | Also fine for this site |

**Best simple path:** zip the `brenda-cottage` folder (or connect the folder to Git) and deploy to **Netlify**.

### Deploy on Netlify (about 5 minutes)
1. Go to [https://app.netlify.com](https://app.netlify.com)
2. Add new site → Deploy manually
3. Drag the `C:\Projects\brenda-cottage` folder onto the upload area
4. Copy the free `*.netlify.app` URL and send it to Brenda
5. Optional: add a custom domain later (e.g. `brendashomestead.com`)

No build step is required. Publish the folder root.

## Run locally

Any static server works. Example:

```powershell
cd "C:\Projects\brenda-cottage"
npx --yes serve -l 5173
```

Then open:
- Public site: http://localhost:5173
- Admin: http://localhost:5173/admin/

## Suggested next steps for Brenda

1. Log into admin and change the password
2. Replace sample products with her real products + photos
3. Add Venmo / Cash App / PayPal / Zelle handles in Settings
4. Add her full street address (needed on Ohio cottage food labels)
5. Print compliant labels: name/address, product, ingredients, net weight, allergens, and **This product is home produced.**
6. Confirm each product is an allowed Ohio cottage food (shelf-stable / non-potentially hazardous)
7. Download a backup after she sets everything up

## What you may still want later

- Cloud-synced orders (so website orders appear on Brenda’s phone automatically)
- Email/text notification when a new order arrives
- Printed label PDF generator from product ingredients
- Real domain name
- Square/PayPal checkout buttons (optional; Venmo-style handles work fine to start)
- Professional food photos

## Legal note

The cottage-law pages are a plain-English learning aid, not legal advice. Ohio rules can change; verify with the Ohio Department of Agriculture / current Ohio Revised Code and Administrative Code when needed.

<!-- netlify trigger 2026-10-07 18:50 -->

