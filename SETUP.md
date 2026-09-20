# Launch setup

Complete the steps in order. Test with Stripe test mode before accepting real payments.

## 1. Create the Supabase project

1. Create a project at `https://supabase.com`.
2. Save the database password somewhere secure.
3. In Supabase, open **SQL Editor**.
4. Copy and run all of `supabase/migrations/202609200001_initial_schema.sql`.

This creates the quote database, server-side price calculation, owner-only access policies, and public submission functions.

## 2. Create the two owner accounts

1. Open **Authentication > Users** in Supabase.
2. Create the first owner with email and password.
3. Create the partner with a separate email and password.
4. Edit `supabase/ADD_OWNERS.sql` and replace both example email addresses.
5. Run the edited owner SQL in **SQL Editor**.

Never share an owner login. Each owner should use a separate account.

## 3. Connect the website

1. In Supabase, open **Project Settings > API**.
2. Copy the **Project URL** and the public **anon/publishable key**.
3. Open `config.js`.
4. The included `config.js` is already configured for the Highland Lakes Supabase project. Replace it only if you create a different project.

The anon/publishable key is designed for browser use. Never place the service-role key or a Stripe secret key in `config.js`, GitHub, or any website file.

## 4. Deploy the Edge Functions

Using the Supabase CLI from the project folder:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook --no-verify-jwt
```

If Supabase offers the in-dashboard function editor, the matching source files are in:

- `supabase/functions/create-checkout-session/index.ts`
- `supabase/functions/stripe-webhook/index.ts`

## 5. Connect Stripe in test mode

1. Create or open the business account at `https://dashboard.stripe.com`.
2. Start in **test mode**.
3. Copy the test secret key from **Developers > API keys**.
4. In Supabase **Edge Functions > Secrets**, add:
   - `STRIPE_SECRET_KEY` = the Stripe test secret key
   - `SITE_URL` = `https://jesseainscough-prog.github.io/-highland-lakes-gutter`
5. In Stripe **Developers > Webhooks**, add this endpoint:
   - `https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`
6. Subscribe it to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `charge.refunded`
7. Reveal the webhook signing secret and add it in Supabase as:
   - `STRIPE_WEBHOOK_SIGNING_SECRET`
8. Redeploy both functions after adding or changing secrets.

## 6. Upload the website to GitHub

Replace the current repository files with the contents of this package. Preserve all folders, including `assets` and `supabase`.

GitHub Pages publishes `index.html`, `owner.html`, `pay.html`, `config.js`, and `assets`. The `supabase` folder is source and deployment documentation; GitHub Pages does not execute it.

## 7. Test the complete workflow

1. Submit a quote on the public website.
2. Confirm it appears in `owner.html` after signing in.
3. Open the customer payment page from the owner portal.
4. Use Stripe's test card `4242 4242 4242 4242`, any future expiration date, and any CVC.
5. Confirm the owner portal changes the deposit to **paid**.
6. Test scheduling, status changes, notes, phone links, email links, and the second owner login.

## 8. Go live

After successful testing:

1. Activate the Stripe account and complete identity/bank verification.
2. Replace the Stripe test secret with the live secret in Supabase.
3. Create a live-mode webhook and replace the webhook signing secret.
4. Redeploy the functions.
5. Make a small real payment and refund it to verify the entire workflow.

Before public launch, confirm the placeholder add-on prices, cancellation/refund policy, privacy language, business phone number, and how Texas sales tax should be handled with the business's accountant.
