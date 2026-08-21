# Deploying the Producers Circle

The app is one Node process serving both the API and the built client, plus a
Postgres database. Uploads go straight from the browser to R2, so the server
never handles file bytes and does not need large instances or disk.

## 1. Database

Any Postgres 14+ works. Two good options:

- **Render Postgres** — provisioned automatically by `render.yaml`.
- **Neon** — generous free tier with point-in-time restore. Paste its
  connection string into `DATABASE_URL` and skip Render's database.

Avoid free tiers that expire: Render's free Postgres is deleted after 30 days.

## 2. Create the schema

The app does **not** migrate on boot — an automatic schema change during a
deploy can drop a column before you notice. Run it deliberately:

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

## 3. Deploy

### Render (blueprint included)

Render → **New → Blueprint** → point at this repo. `render.yaml` provisions the
web service and database, generates `SESSION_SECRET`, and wires
`DATABASE_URL`. Fill the remaining secrets in the dashboard.

Do not use a free web instance: free services sleep when idle, and a sleeping
service misses Stripe webhooks, so paid memberships silently fail to activate.

### Anywhere else

The `Dockerfile` is self-contained and works on Fly, Railway, Cloud Run or any
container host:

```bash
docker build -t producers-circle .
docker run -p 5000:5000 --env-file .env producers-circle
```

It runs as a non-root user and starts `node` directly rather than through npm,
so the process receives `SIGTERM` and can drain in-flight requests.

## 4. Environment

See `.env.example` for the full annotated list. Required:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `SESSION_SECRET` | `openssl rand -hex 32`. The server refuses to boot without it in production |
| `APP_BASE_URL` | `https://yourdomain.com` — used to build links in emails |

Everything else degrades gracefully: without Stripe keys billing endpoints
error, without Resend the reset email is written to the log, without R2 the
upload endpoints return 503. The app still boots and serves.

## 5. Stripe

1. Create the product once: `npx tsx scripts/seed-producers-circle.ts`
2. Copy the price id into `STRIPE_PRICE_ID`.
3. Add a webhook endpoint at `https://yourdomain.com/api/stripe/webhook`,
   subscribed to `checkout.session.completed`,
   `customer.subscription.updated` and `customer.subscription.deleted`.
4. Put that endpoint's signing secret in `STRIPE_WEBHOOK_SECRET`.

The webhook returns 500 on a handling failure so Stripe retries. Returning 200
would silently strand a paying member without access.

## 6. Email

Verify your sending domain in Resend (SPF + DKIM) before real signups. An
unverified domain is the fastest route to the spam folder, and matters far more
than the choice of provider. Add a DMARC record once SPF and DKIM pass.

## 7. R2

Create a bucket and an API token scoped to it (Object Read & Write). **Keep the
bucket private** — no public access policy. Everything is served through
short-lived signed URLs after the app checks who is asking.

The browser uploads cross-origin, so the bucket needs a CORS rule:

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

## 8. First administrator

A fresh database has no ministry (admin) account, and the in-app grant endpoint
requires an existing one. Register through the app, then:

```bash
DATABASE_URL='postgres://...' npm run grant-ministry you@example.com
```

After that, further admins can be granted in-app.

## 9. Verify the deploy

```bash
curl https://yourdomain.com/api/health         # {"status":"ok",...}
curl https://yourdomain.com/api/health/ready   # {"status":"ready","database":"up"}
```

`/api/health` is liveness only and never touches the database — point the
platform's health check there, so a database blip does not cause a restart
loop. `/api/health/ready` is the one that proves Postgres is reachable.

Then register an account, upload a file to a project, and confirm playback.

## Operational notes

- **Sessions** live in Postgres (`user_sessions`), so restarts and deploys do
  not log members out.
- **Demo accounts** (alice/bob/zara/malik) never appear in production: the seed
  is gated on `NODE_ENV`, and the build hardcodes it to `production`.
- **Cost shape**: R2 has no egress fees, which is the reason to prefer it here
  — streaming audio from S3 would bill for every play.
