# Going live — a walkthrough

This is the ordered version: do these in sequence and nothing waits on
something you have not started yet. The reference material (every environment
variable, every operational note) is at the bottom; the stages come first.

The shape of the thing you are deploying: one Node process serving both the API
and the built client, one Postgres database, and Cloudflare R2 for files.
Uploads go from the browser straight to R2, so the server never handles file
bytes and does not need a large instance or a disk.

**Where you are now:** nothing is deployed. The Replit deployment, if it is
still answering, is running pre-migration code.

---

## Stage 0 — Today, before you touch a host

Two things here. Neither takes long, and both block later stages if you leave
them.

### 0a. Deal with the Replit deployment

Stopping the Repl is **not** the same as stopping the Deployment. A Replit
Deployment keeps serving after the editor is closed, and keeps billing. In the
Repl, open the **Deployments** pane, then Stop or Delete it. Confirm the
`.replit.app` URL no longer answers.

Do this now rather than later. That deployment runs the code from before the
migration, where login took a username and **no password** — anyone who knows a
member's username can sign in as them. It is the single largest open risk in
the project today, and it is closed by one click.

Before switching it off, move anything still pointing at it:

- Any custom domain's DNS.
- The Stripe webhook endpoint, if it was registered against the Replit URL.
- Secrets stored in Replit's Secrets pane — they are deliberately not in this
  repo, so copy anything you still need somewhere safe first.

### 0b. Start the things that wait on other people

These have lead times measured in hours or days, so start them today and let
them run in the background while you do Stage 1.

| Thing | Why it waits | What to do |
|---|---|---|
| **Domain DNS** | propagation | Point the domain at the host you pick in Stage 1 (Render gives you a CNAME target) |
| **Resend sending domain** | DNS + provider verification | Add the SPF and DKIM records Resend gives you. Unverified domains go to spam, and that matters far more than which provider you chose |
| **Stripe account** | identity and bank verification | Finish the account onboarding. This is the one gated on the ministry bank accounts — everything else can proceed in test mode without it |
| **Cloudflare R2 bucket** | none, but do it while you are here | Create the bucket and an API token scoped to it (Object Read & Write). Keep the bucket **private** — no public access policy |

Nothing in Stage 1 requires any of these to be finished. The app boots without
Stripe, without Resend and without R2; those features return errors or 503 and
the rest of the site works.

---

## Stage 1 — This week: deploy with nobody on it

The goal of this stage is a URL that answers, that you have not told anybody
about. Stripe stays in **test mode** for the whole stage.

### 1. Database

Any Postgres 14+ works. Two good options:

- **Render Postgres** — provisioned automatically by `render.yaml`.
- **Neon** — generous free tier with point-in-time restore. Paste its
  connection string into `DATABASE_URL` and skip Render's database.

Avoid free tiers that expire: Render's free Postgres is deleted after 30 days.

### 2. Create the schema

The app does **not** migrate on boot — an automatic schema change during a
deploy can drop a column before you notice. Run it deliberately, from your
machine, against the new database:

```bash
DATABASE_URL='postgres://...' npm run db:push
```

For ongoing changes prefer versioned migrations over `push`, which diffs and
can drop columns without asking:

```bash
npm run db:generate   # writes migrations/ from shared/schema.ts
npm run db:migrate    # applies them
```

Commit the generated `migrations/` directory.

### 3. Deploy the web service

**Render (blueprint included).** Render → **New → Blueprint** → point at this
repo. `render.yaml` provisions the web service and database, generates
`SESSION_SECRET`, and wires `DATABASE_URL`. Fill the remaining secrets in the
dashboard.

Do not use a free web instance: free services sleep when idle, and a sleeping
service misses Stripe webhooks, so paid memberships silently fail to activate.

**Anywhere else.** The `Dockerfile` is self-contained and works on Fly,
Railway, Cloud Run or any container host:

```bash
docker build -t producers-circle .
docker run -p 5000:5000 --env-file .env producers-circle
```

It runs as a non-root user and starts `node` directly rather than through npm,
so the process receives `SIGTERM` and can drain in-flight requests.

### 4. Set the environment

`.env.example` is the annotated full list. The three that must be set:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `SESSION_SECRET` | `openssl rand -hex 32`. The server refuses to boot without it in production |
| `APP_BASE_URL` | `https://yourdomain.com` — used to build the links inside emails |

Add `STRIPE_SECRET_KEY` with a **test-mode** key (`sk_test_…`) now, and the R2
and Resend values as those finish verifying. Everything not yet set degrades
rather than crashing.

### 5. R2 CORS

The browser uploads cross-origin, so the bucket needs a CORS rule. This is the
step most likely to be forgotten, because the server looks perfectly healthy
while every upload fails in the member's browser:

```json
[{
  "AllowedOrigins": ["https://yourdomain.com"],
  "AllowedMethods": ["PUT", "GET"],
  "AllowedHeaders": ["content-type"],
  "ExposeHeaders": ["etag"],
  "MaxAgeSeconds": 3000
}]
```

Add your local origin too while developing.

### 6. Stripe, in test mode

1. Create the product once: `npx tsx scripts/seed-producers-circle.ts`
2. Copy the price id into `STRIPE_PRICE_ID`.
3. Add a webhook endpoint at `https://yourdomain.com/api/stripe/webhook`,
   subscribed to `checkout.session.completed`,
   `customer.subscription.updated` and `customer.subscription.deleted`.
4. Put that endpoint's signing secret in `STRIPE_WEBHOOK_SECRET`.

The webhook returns 500 on a handling failure so that Stripe retries. Returning
200 would silently strand a paying member without access.

### 7. Run preflight

This is the checkpoint for the stage. It runs from **outside** the deployment,
the way a member's browser would, so it catches the class of problem that never
shows up in local testing — a proxy stripping headers, a cookie that will not
set over the real TLS chain, a demo account that survived into production:

```bash
npm run preflight -- https://yourdomain.com
```

It checks HTTPS, that the client is served, both health probes, that the
database is reachable, that the demo accounts do **not** exist, and that the
Stripe webhook rejects an unsigned payload.

Add `--register` to also exercise signup end to end:

```bash
npm run preflight -- https://yourdomain.com --register
```

That additionally checks registration, that the session cookie carries
HttpOnly + Secure + SameSite, that a presigned upload URL is issued, and that
R2's CORS rule actually allows your origin. It leaves one throwaway account
behind — the output tells you which — so delete it, or run `--register` only
before you have real members.

The command exits non-zero if anything failed. Do not move to Stage 2 with a
FAIL on the board; a WARN about R2 being unset is fine at this point.

### 8. Make yourself the first administrator

A fresh database has no ministry (admin) account, and the in-app grant endpoint
requires an existing one — so the first one is granted from the command line:

```bash
DATABASE_URL='postgres://...' npm run grant-ministry you@example.com
```

Register through the app first, then run that against your own address. After
this, further administrators can be granted in-app.

---

## Stage 2 — Then: three to five people you trust

Still test-mode Stripe. Give the URL to a handful of people and ask them to
actually use it: register, create a project, upload a stem, play it back,
submit to a cypher, log stewardship hours, reset their password.

What you are looking for is not bugs in the abstract — it is the two failures
that only appear with real people on real devices:

- **Email deliverability.** Does the password reset actually arrive, and does
  it land in the inbox rather than spam? Ask each person to check. If it
  spams, DMARC is the next record to add once SPF and DKIM pass.
- **Uploads from a phone.** Different browsers, different content types, worse
  networks. This is where the CORS rule and the content-type allowlist get
  their real test.

Watch the logs while they are on. Fix what surfaces. Nothing here is urgent
enough to rush past.

---

## Stage 3 — Then: live Stripe, and open the doors

Only once Stage 2 is quiet, and only once the ministry bank accounts are
connected:

1. Swap `STRIPE_SECRET_KEY` to the live key (`sk_live_…`).
2. Create the product again in live mode (`scripts/seed-producers-circle.ts`)
   and update `STRIPE_PRICE_ID` — test-mode and live-mode ids are different.
3. Create the webhook endpoint again in live mode and update
   `STRIPE_WEBHOOK_SECRET` — this secret is per-endpoint, so the test-mode one
   will not verify live events.
4. Re-run `npm run preflight -- https://yourdomain.com` (without `--register`
   now — do not create throwaway accounts in a live database).
5. Make one real membership purchase yourself with a real card, confirm the
   webhook fired in the Stripe dashboard and that your account reflects it,
   then refund it.

Step 5 is the only way to know the live path works. The test-mode path passing
does not prove it: different keys, different webhook secret, different
endpoint.

Then tell people.

---

## Before real members: the open questions

These are not deployment steps, but they are things to settle rather than
discover:

- **Beat licensing and royalty splits** still move value between individual
  members. Under a 508(c)(1)(A) that is the area a lawyer should look at, and
  it is worth doing before money moves rather than after.
- **The `--register` throwaway account** from Stage 1 — delete it.
- **The Cypher Pass hour thresholds** (40 study / 40 service) are a placeholder
  I chose to make the four roads work. They are a governance decision, not a
  technical one; set them where the ministry means them to be.

---

# Reference

## Environment

`.env.example` carries the full annotated list. Required: `DATABASE_URL`,
`SESSION_SECRET`, `APP_BASE_URL`.

Everything else degrades gracefully: without Stripe keys the billing endpoints
error, without Resend the reset email is written to the log, without R2 the
upload endpoints return 503. The app still boots and serves.

## Health probes

```bash
curl https://yourdomain.com/api/health         # {"status":"ok",...}
curl https://yourdomain.com/api/health/ready   # {"status":"ready","database":"up"}
```

`/api/health` is liveness only and never touches the database — point the
platform's health check there, so that a database blip does not cause a restart
loop. `/api/health/ready` is the one that proves Postgres is reachable.

## Running the tests

```bash
npm test
```

Unit tests run anywhere. The route-level suite additionally needs a database
and is skipped without one — point it at a throwaway database, since it
TRUNCATEs every table:

```bash
createdb guildtest
DATABASE_URL='postgres://.../guildtest' npm run db:push
TEST_DATABASE_URL='postgres://.../guildtest' npm test
```

## Operational notes

- **Sessions** live in Postgres (`user_sessions`), so restarts and deploys do
  not log members out.
- **Demo accounts** (alice/bob/zara/malik) never appear in production: the seed
  is gated on `NODE_ENV`, and the build hardcodes it to `production`. Preflight
  checks this from outside rather than trusting it.
- **Rolling back** is a redeploy of the previous commit. The schema is the part
  that does not roll back on its own — that is why `db:push` is a deliberate
  step rather than something the deploy does for you.
- **Cost shape**: R2 has no egress fees, which is the reason to prefer it here
  — streaming audio out of S3 would bill for every play.
