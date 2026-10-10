# Lead system — one-time setup

The portfolio is a static site on GitHub Pages. It cannot hold a secret, so
everything privileged happens in a Supabase Edge Function:

```
GitHub Pages                 Supabase Edge Function            External
────────────                 ──────────────────────            ────────
request.html  ──POST────────▶ project-estimate ──────────────▶ Gemini
admin.html    ──auth/RLS────▶ PostgreSQL (portfolio_leads)     Resend
              ──POST────────▶ resend-notification
```

**The browser never receives** `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`RESEND_API_KEY` or `TURNSTILE_SECRET_KEY`. It receives only the Supabase URL,
the Supabase **anon** key and the Turnstile **site** key — all public by design.

Everything that could be built without your accounts is built and tested. The
steps below are the ones that need you to be signed in somewhere.

---

## What you need

| | |
| --- | --- |
| Supabase account | free tier is enough |
| Resend account | free tier is enough |
| Gemini API key | you already have one in `GEMINI_API_KEY` on your Windows machine |
| Supabase CLI | `npm i -g supabase` (or `scoop install supabase`) |

You will never need to paste the Gemini key into a file in this repository.

---

## 1. Create the Supabase project

1. <https://supabase.com/dashboard> → **New project**.
2. Pick the region closest to your clients (Frankfurt is a good default for
   Egypt and the Gulf).
3. Save the database password somewhere safe. You will not need it again for
   this setup.
4. From **Project Settings → API**, copy:
   - **Project URL** → this is `SUPABASE_URL`
   - **anon public** key → this is `SUPABASE_ANON_KEY` (public, goes in the site)
   - **service_role** key → this is `SUPABASE_SERVICE_ROLE_KEY` (**secret**, never in the site)

---

## 2. Apply the database migrations

From the repository root:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

That applies `backend/supabase/migrations/`:

- `0001_portfolio_leads.sql` — the `portfolio_leads` table, the `admin_users`
  allow-list, and Row Level Security.
- `0002_rate_limit.sql` — the throttle table and `throttle_check()`.

If you prefer the dashboard, paste each file into **SQL Editor** and run them
in order.

### What RLS actually enforces

Verified against a real PostgreSQL 16 instance (`backend/tests/rls_test.sql`,
27 assertions, all passing):

| Caller | Can do |
| --- | --- |
| Anonymous (the public site's anon key) | **nothing** — no select, insert, update or delete |
| Signed in, not on the allow-list | sees **zero rows**; updates affect zero rows |
| Signed in, on the allow-list | read every lead; update **only** `status`, `admin_notes`, and the two notification columns |
| The Edge Function (service role) | insert and update |

Nobody with a browser can delete a lead, and an admin cannot edit the
customer's own words or the stored price — those columns are not granted.

---

## 3. Create your admin account

1. **Authentication → Users → Add user**, with your email and a strong
   password. Tick *Auto Confirm User*.
2. Copy the new user's **UID**.
3. **SQL Editor**:

   ```sql
   insert into public.admin_users (user_id, email)
   values ('<paste-the-uid>', '<your-email>');
   ```

Being in `admin_users` is what grants access. Removing the row revokes it
immediately — no redeploy.

---

## 4. Create the Resend sender

1. <https://resend.com> → **API Keys** → create one with *Sending access*.
   That is `RESEND_API_KEY`.
2. For testing, `leads@resend.dev` works as a sender with no setup.
   For production, add your domain under **Domains** and verify the DNS
   records, then use an address on it (e.g. `leads@yourdomain.com`).

---

## 5. Set the function secrets

Create a local `.env` (it is git-ignored; `.env.example` lists the names):

```bash
cp .env.example .env
```

Fill it in. On Windows, the Gemini key is already in your environment, so you
never have to read it or type it:

```powershell
# PowerShell, from the repository root
Add-Content .env "GEMINI_API_KEY=$env:GEMINI_API_KEY"
```

Then push every secret to Supabase and delete the local copy:

```bash
supabase secrets set --env-file ./.env
rm .env          # the secrets now live in Supabase, not on disk
```

Minimum required: `GEMINI_API_KEY`, `RESEND_API_KEY`,
`ADMIN_NOTIFICATION_EMAIL`, `SUPABASE_ANON_KEY`, `THROTTLE_SALT`,
`ALLOWED_ORIGINS`, `PUBLIC_SITE_URL`.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically into
deployed functions — set them only for local runs.

`THROTTLE_SALT` should be a long random string:

```bash
openssl rand -hex 32
```

`ALLOWED_ORIGINS` is the exact origin the site is served from — for GitHub
Pages that is `https://mohamedgamal-attia.github.io` (origin only, no path).

---

## 6. Deploy the functions

```bash
supabase functions deploy project-estimate
supabase functions deploy resend-notification
```

Their URLs are:

```
https://<project-ref>.supabase.co/functions/v1/project-estimate
https://<project-ref>.supabase.co/functions/v1/resend-notification
```

---

## 7. Connect the site

Edit `assets/js/config.js` — **public values only**:

```js
leadSystem: {
  endpoint:         'https://<project-ref>.supabase.co/functions/v1/project-estimate',
  resendEndpoint:   'https://<project-ref>.supabase.co/functions/v1/resend-notification',
  supabaseUrl:      'https://<project-ref>.supabase.co',
  supabaseAnonKey:  'eyJ...',      // the ANON key, never the service_role key
  turnstileSiteKey: '',            // optional, see below
},
```

Then re-stamp the asset cache-busting hashes and push:

```bash
python3 scripts/version_assets.py
git add -A && git commit -m "Connect the lead system" && git push
```

Until `endpoint` is filled in, the wizard says so plainly instead of
pretending to submit. The same is true of the dashboard.

---

## 8. Optional — Cloudflare Turnstile

Without it the form is still protected by a honeypot and a server-side rate
limit (5 submissions per IP per hour by default).

1. <https://dash.cloudflare.com> → **Turnstile** → add a site for your Pages
   domain.
2. Put the **site key** in `config.js` as `turnstileSiteKey`.
3. `supabase secrets set TURNSTILE_SECRET_KEY=<secret>`.

The function enforces Turnstile only when `TURNSTILE_SECRET_KEY` is set, so
this can be added later without any code change.

---

## 9. Check it end to end

1. Open `request.html`, submit a real-looking request.
2. You should see a preliminary estimate and a reference like `MG-7K4P2Q`.
3. Check your inbox for the notification.
4. Open `admin.html`, sign in, and confirm the lead is there with its quote.

If the estimate does not appear but the lead does, Gemini is the problem and
the system behaved correctly — the lead is never lost to an AI failure.
`supabase functions logs project-estimate` will say which step failed.

---

## Tuning the pricing

Everything that decides a price lives in
`backend/supabase/functions/_shared/pricing-config.js`:

- `BASE_RANGES` — the USD band per project type, and its absolute `floor`.
- `TIER_A` / `TIER_C` — country affordability groups (anything unlisted is
  Tier B). Countries are grouped by broad income level as a transparent proxy;
  this is not a claim to know any local market rate.
- `COMPLEXITY_SIGNALS` — the phrases that raise complexity, in English and
  Arabic, with their weights.

Change the numbers, never the arithmetic in `pricing.js`. Then:

```bash
node --test backend/tests/*.test.mjs     # 46 tests, including floor invariants
supabase functions deploy project-estimate
```

One of those tests walks every project type × country × complexity
combination and asserts no quote can fall below its floor, so a bad edit is
caught before it reaches a customer.

---

## Where the money can be spent

Gemini is called **once** per accepted submission, and only after:

1. the body size check,
2. the rate limit,
3. full validation,
4. the honeypot and Turnstile checks,
5. the lead being written to the database.

A bot that fills the honeypot receives a success-shaped response and costs
nothing. A rejected submission never reaches the model.

---

## Notes

- The admin dashboard is English-only on purpose: it is a single-operator
  internal tool, not part of the public bilingual site.
- `admin.html` is `noindex`, but that is tidiness, not security. The security
  is Supabase Auth plus RLS, and it holds whether or not anyone knows the URL.
- The dashboard loads `@supabase/supabase-js` from jsDelivr at a pinned
  version. No other page on the site loads a third-party script.
