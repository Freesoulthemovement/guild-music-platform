# Guild Music Platform

A music collaboration platform for producers and artists.

## Stack
- Frontend: React + TypeScript + Vite + Tailwind CSS
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL (Drizzle ORM)
- Payments: Stripe

## Running locally

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL and SESSION_SECRET
npm run db:push           # create the schema
npm run dev
```

Stripe, email and file storage are optional locally — see `.env.example` for
how each degrades when unset.

## Deploying

See [DEPLOYMENT.md](DEPLOYMENT.md). A `render.yaml` blueprint and a portable
`Dockerfile` are both included.

