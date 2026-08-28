# Deploying ft-digital-admin

Target: **Netlify** (separate site from the marketing site), domain
`admin.4firsttech.com`.

## 1. Supabase (shared by both apps)

1. Create the project. Note the project ref.
2. Apply migrations: `bunx supabase link --project-ref <ref>` then
   `bunx supabase db push` (or paste `supabase/migrations/*.sql` in order into the
   SQL editor).
3. Confirm the storage buckets exist: **`media`** (public) and
   **`mail-attachments`** (private).
4. Auth → Providers → Email: enable **Email** provider, turn **off** "Enable email
   signups" (invite-only). Set the Site URL to `https://admin.4firsttech.com` and
   add it to the redirect allow-list.

## 2. Resend

1. Domains → add **`mail.4firsttech.com`**; add the SPF / DKIM / DMARC DNS records.
2. Emails → Receiving → copy the inbound address; add an **MX** record on
   `mail.4firsttech.com` pointing at it with the **lowest priority number**
   (keep the root `4firsttech.com` MX for Google/M365 untouched).
3. Webhooks → New webhook → event **`email.received`** → URL
   `https://admin.4firsttech.com/api/resend/inbound`. Copy the **signing secret**.

## 3. Netlify

1. New site → import `ft-digital-admin` from Git. Build command `npm run build`,
   publish dir `dist` (already in `netlify.toml`). The Nitro Netlify preset is
   picked up automatically from `NETLIFY=true`.
2. Site settings → Environment variables:

   ```
   SUPABASE_URL
   SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   VITE_SUPABASE_URL          (= SUPABASE_URL)
   VITE_SUPABASE_ANON_KEY     (= SUPABASE_ANON_KEY)
   RESEND_API_KEY
   RESEND_WEBHOOK_SECRET
   MAIL_DOMAIN=mail.4firsttech.com
   SHARED_MAILBOX_OWNER=hello@mail.4firsttech.com
   APP_URL=https://admin.4firsttech.com
   ```

3. Domain management → add `admin.4firsttech.com`, point the CNAME at Netlify.
4. Trigger a deploy.

## 4. First admin

Run locally against the production project (service-role key in `.env`):

```bash
bun run seed-admin -- --email founder@4firsttech.com --name "Founder Name"
```

Sign in at `https://admin.4firsttech.com/login`, then invite the rest of the team
from **Settings → Members** (each invite provisions their mailbox automatically).

## 5. Wire the marketing site

In the `ft-digital-home` Netlify site, add:

```
SUPABASE_URL=<same as above>
SUPABASE_ANON_KEY=<same anon key>
```

Deploy it. It now reads published CMS content from Supabase, falling back to the
in-code defaults when a row is missing — so a bad deploy or empty table never
breaks the live site.

## Smoke test

- [ ] Sign in to the admin, dashboard loads with live counts.
- [ ] Edit an About discipline → **Publish** → reload `4firsttech.com/about` → change shows.
- [ ] Clear that collection's rows → the site still renders the original copy (fallback).
- [ ] Compose an email from **Mail** to a personal address → it arrives; a `sent` row appears.
- [ ] Reply from that personal address → within a few seconds it appears in the
      member's Inbox (check Netlify function logs / `resend` CLI if not).
- [ ] Open the reply → attachments download.
- [ ] Sign in as a second member → they cannot see the first member's mail.
- [ ] Submit the marketing contact form → a row appears in **Dashboard → intake**
      and the notification email still sends.
