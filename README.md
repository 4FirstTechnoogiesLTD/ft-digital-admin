# ft-digital-admin

Standalone admin center for the **4First Technologies** marketing site
([`ft-digital-home`](../ft-digital-home)). Two things live here:

1. **CMS** — edit every piece of content the marketing site renders (page copy,
   SEO/meta, service & case-study collections, contact details, media). Publishing
   here updates `4firsttech.com` live.
2. **Team mailbox** — each member gets a personal address on `mail.4firsttech.com`
   and can send / receive real email (threads, attachments, labels, drafts),
   powered by [Resend](https://resend.com) inbound + outbound.

Same stack and visual theme as the marketing site: **TanStack Start** (React 19),
**Vite**, **Tailwind v4**, **shadcn/ui**. Data + auth + storage + realtime on
**Supabase**. Deploys to **Netlify**.

---

## Local setup

```bash
bun install
cp .env.example .env      # then fill in the values (see below)
```

### 1. Supabase

Create a project at supabase.com, then apply the migrations in `supabase/migrations/`
(in order) via the SQL editor or the Supabase CLI:

```bash
bunx supabase link --project-ref <ref>
bunx supabase db push
```

This creates every table + RLS policy, the `media` and `mail-attachments` storage
buckets, and seeds the current marketing-site content so the CMS starts populated.

Copy these into `.env`:

| var | where |
| --- | --- |
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | Project settings → API → Project URL |
| `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` | Project settings → API → `anon` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Project settings → API → `service_role` key (**server only**) |

### 2. Resend

- Verify the subdomain **`mail.4firsttech.com`** (Domains → Add Domain) and add the
  SPF / DKIM / DMARC records it shows.
- Emails → Receiving → copy the inbound address, add an **`MX`** record on
  `mail.4firsttech.com` with the *lowest* priority.
- Webhooks → add a webhook for **`email.received`** → `https://<app-url>/api/resend/inbound`.
  Copy the signing secret.

```
RESEND_API_KEY=re_...
RESEND_WEBHOOK_SECRET=whsec_...
MAIL_DOMAIN=mail.4firsttech.com
SHARED_MAILBOX_OWNER=hello@mail.4firsttech.com   # inbound with no matching mailbox lands here
APP_URL=http://localhost:3000
```

> Locally there's no public URL for the webhook. Use `bunx resend inbound listen`
> (Resend CLI) or an ngrok tunnel to receive test mail during development.

### 3. First admin

```bash
bun run seed-admin -- --email you@company.com --name "Your Name" --password "choose-one"
```

Then `bun run dev` and sign in at `/login`.

---

## Scripts

| command | does |
| --- | --- |
| `bun run dev` | dev server on :3000 |
| `bun run build` | production build (`.output/`, or `dist/` on Netlify) |
| `bun run lint` / `bun run format` | eslint / prettier |
| `bun run seed-admin -- --email … --name …` | create/promote an admin + mailbox |

Regenerate typed DB definitions once linked:

```bash
bunx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
```

---

## Docker

The app is stateless — Postgres, Auth, Storage and Realtime all live in Supabase —
so the image just serves the built Nitro node server on port 3000.

```bash
cp .env.example .env      # fill in Supabase + Resend values
docker compose up --build
# → http://localhost:3000
```

Or without compose:

```bash
docker build -t ft-digital-admin .
docker run --rm -p 3000:3000 --env-file .env ft-digital-admin
```

The `Dockerfile` is multi-stage (Bun builds with `NITRO_PRESET=node-server`, a slim
`node:22-alpine` runs it as a non-root user) and carries a `HEALTHCHECK` against
`/login`. Override the host port with `ADMIN_PORT` when using compose. The Resend
inbound webhook still needs a public URL — put the container behind your reverse
proxy / tunnel and point the webhook at `https://<host>/api/resend/inbound`.

## How it fits together

```
ft-digital-home (marketing site)        ft-digital-admin (this repo)
  SSR loaders read PUBLISHED content       CMS write UI + audit log
  via the anon key + RLS, with              Supabase email/password auth
  in-code fallbacks (src/content/           per-user mailbox:
  defaults.ts) so it renders even             /api/resend/inbound  ← Resend webhook
  when the DB is empty                        sendMessage()        → Resend /emails
                    \                        /
                     Supabase  ·  Resend
```

Deployment steps: **`DEPLOYMENT.md`**.
