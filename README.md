# izipass

Paid events for Uzbekistan: registration with a limit, payment confirmation by receipt, tickets in Apple Wallet and Google Wallet, door check-in by scan. The plan is in `docs/plan.md`.

izipass never holds money: attendees pay the organizer directly. Pass signing is done by the wallet project (`wallet.myrzan.com`) through its API, so Apple and Google credentials live only there.

## Stack

- Next.js 16 (App Router), shadcn/ui, Tailwind CSS v4. UI is built from shadcn components and tokens only.
- Postgres (Neon) with Drizzle ORM; migrations in `drizzle/`, applied on build.
- Sign-in with Telegram (Login Widget) or email (one-time link via Resend). Sessions are signed cookies (JWT, 30 days).
- Languages: uz / ru / kk / en, locale in the URL (`/ru/...`).
- Tickets: a confirmed registration gets a QR (`/t/<id>~<signature>`, HMAC-signed, nothing stored) and "Add to Apple Wallet / Google Wallet" buttons. Passes are built by the wallet project's `POST /api/v1/passes` (`WALLET_API_URL`, `WALLET_API_KEY`), so Apple and Google credentials never live here.
- Check-in: `/dashboard/events/[id]/scan` reads QR codes with the camera (ZXing wasm served from `/zxing`, copied on install), verifies them against a ticket list cached on the phone, so it works offline, and syncs check-ins when back online. A reference code can be typed instead.
- Registrations: a spot is held for the event's payment time limit; the attendee uploads a receipt screenshot (stored in Postgres, purged 30 days after the event); the organizer approves or rejects; a waitlist fills freed spots. Holds expire lazily on every read and daily via `/api/cron` (`vercel.json`, `CRON_SECRET`).
- Auto-check (paid add-on, 500 so'm per checked participant, no API key): with the organizer's *Enable auto-check* on, the attendee's browser reads the screenshot with tesseract.js (engine and eng+rus data served from `/tesseract`, copied on install) and posts the text to `/api/receipts/[id]/text`. `src/lib/receipt-check.ts` extracts amount, date, card, receipt number and status and checks them against the price, the registration time, the organizer's payout card and earlier receipts (duplicate image hash or number). The verdict and failed checks show in the registrations table; with *Confirm automatically* on, a passing receipt confirms the spot by itself. Nothing is auto-rejected.

## Develop

```bash
npm install
cp .env.example .env.local   # at least DATABASE_URL and SESSION_SECRET
npm run db:migrate           # applies drizzle/ to DATABASE_URL
npm run dev                  # http://localhost:3000
```

Without `RESEND_API_KEY` the email sign-in link is printed to the dev console. Without `TELEGRAM_BOT_TOKEN` the Telegram button is hidden.

Checks: `npm run typecheck`, `npm run lint`, `npm test` (tests run the real schema on an in-memory Postgres), `npm run build`.

Schema changes: edit `src/lib/db/schema.ts`, then `npm run db:generate` and commit the new file in `drizzle/`.

## Layout

```
src/app/[lang]/              landing, login, dashboard (locale from the URL; proxy.ts redirects / and guards /dashboard)
src/app/[lang]/o/[slug]/     public organizer page, event page, register
src/app/[lang]/r/[id]        attendee's registration: pay, upload receipt, status, ticket
src/app/[lang]/t/[token]     public ticket page (what a camera scan opens)
src/app/api/tickets          Apple .pkpass download / Google save redirect via the wallet project
src/app/api/auth/            telegram, email, email/verify, logout
src/app/api/registrations    receipt upload; api/receipts serves them and takes the OCR text; api/cron housekeeping
src/lib/auth/                session cookie, Telegram verification, login tokens, user data access
src/lib/db/                  Drizzle schema + client
src/lib/receipt-check.ts     receipt text → fields → auto-check verdict (pure)
src/lib/i18n/                dictionaries
docs/plan.md                 product plan and decisions
```

## Deploy (Vercel)

1. Import the repo, framework Next.js. Domain: `izipass.myrzan.com`.
2. Storage → create **Neon Postgres** and connect it (`DATABASE_URL`).
3. Env vars from `.env.example`: `SESSION_SECRET`, `TELEGRAM_BOT_TOKEN`, `NEXT_PUBLIC_TELEGRAM_BOT`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`, `WALLET_API_KEY` (the same value goes into `WALLET_API_KEYS` of the wallet project).
4. In @BotFather: `/setdomain` → `izipass.myrzan.com` for the bot.
5. In Resend: verify the sending domain for `EMAIL_FROM`.

The build runs migrations before `next build`.
