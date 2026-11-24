# novacold.agency

Static one-page site, hosted on GitHub Pages with the custom domain `novacold.agency` (see `CNAME`).

## Edit contact details

Open `site.config.js` and fill in:

- `demoPhoneNumber`: the live AI demo line, with country code, e.g. `"+1 (555) 010-2030"`
- `bookingLink`: your booking page, e.g. `"https://cal.com/yourname"`
- `email`: shown in the footer
- `currencySymbol`, `trialDays`: calculator symbol and free-trial length

Any value left as `""` hides its buttons or text. Commit the change and GitHub Pages republishes in about a minute.

## Before launch

- Fill in at least `demoPhoneNumber` or `bookingLink` (otherwise the page has no buttons).
- Replace the placeholder text in `privacy.html` and `terms.html`.

`assets/css/styles.css` is pre-built Tailwind CSS. Don't edit it by hand.
