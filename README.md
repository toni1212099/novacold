# novacold.agency

Static site hosted on Netlify (deploys automatically from `main` on GitHub). Settings are in `netlify.toml`.

## Edit contact details

Open `site.config.js` and fill in:

- `demoPhoneNumber`: the live AI demo line, with country code, e.g. `"+1 (555) 010-2030"`
- `bookingLink`: your booking page, e.g. `"https://cal.com/yourname"`
- `email`: shown in the footer
- `currencySymbol`, `trialDays`: calculator symbol and free-trial length
- `pricingStarterLink`, `pricingProLink`: where the homepage Pricing buttons go (default: `/checkout.html?plan=starter` and `/checkout.html?plan=pro`)

Any value left as `""` hides its buttons or text. Commit the change and Netlify republishes in about a minute.

## Checkout

`checkout.html?plan=starter|pro` is a 4-step signup (Personal, Business, Agent, Payment), logic in `assets/js/checkout.js`.

- Step 3 posts the answers to `netlify/functions/create-client.mjs`, which validates them and creates a record in the Airtable table **Clients** (Status = `Form filled`).
- Step 4 shows the PayPal subscription button with `custom_id` = the Airtable record ID. After approval, `netlify/functions/mark-paid.mjs` sets Status = `Paid` and `PayPal subscription ID`.

Environment variables (set in Netlify under Site configuration > Environment variables, **never** in this repo, it's public):

- `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID`: required.
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`: required for `mark-paid`. It asks PayPal's API to confirm each subscription (exists, active, `custom_id` = record ID, right plan) before marking a record Paid. Without them, nothing is marked Paid.
- Optional: `MAX_SIGNUPS_PER_HOUR` (default 20) and `MAX_SIGNUPS_PER_DAY` (default 60, max 100) cap new Airtable records; `ALLOWED_ORIGINS` adds extra allowed site origins (comma separated); `PAYPAL_API_BASE` (set to `https://api-m.sandbox.paypal.com` to test with PayPal sandbox).

Security: functions only accept requests from novacold.agency (and the Netlify site URL), reject unknown fields, validate every value, have a honeypot field and per-IP limits, and never return internal errors. Security headers (CSP etc.) are in `netlify.toml`.

PayPal plan IDs live in `assets/js/checkout.js` and `netlify/functions/mark-paid.mjs`.

## Before launch

- Fill in at least `demoPhoneNumber` or `bookingLink` (otherwise the page has no buttons).
- Replace the placeholder text in `privacy.html` and `terms.html`.

`assets/css/styles.css` is pre-built Tailwind CSS. Don't edit it by hand.
