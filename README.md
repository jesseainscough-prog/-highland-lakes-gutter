# Highland Lakes Seamless Rain Gutter

Operational website package with online estimates, secure owner login, saved customer requests, scheduling, crew planning, and Stripe Checkout deposits.

## Main files

- `index.html` — public website and estimator
- `owner.html` — password-protected owner portal
- `pay.html` — customer deposit page
- `config.js` — public Supabase connection values
- `supabase/migrations/` — database schema and security policies
- `supabase/functions/` — Stripe Checkout and webhook functions
- `SETUP.md` — complete launch instructions

## Pricing currently configured

- 6-inch seamless gutter: $12 per linear foot
- 7-inch seamless gutter: $22 per linear foot
- Gutter guards: $11 per linear foot (placeholder; confirm before launch)
- Removal and haul-off: $2.50 per linear foot (placeholder; confirm before launch)
- Downspouts: $120 each (placeholder; confirm before launch)
- Deposit: 50%

The database calculates pricing independently of the browser so visitors cannot alter totals by changing browser code.

Read `SETUP.md` before replacing the existing GitHub Pages files.
