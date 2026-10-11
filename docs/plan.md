# izipass: plan

*Status: planning, decisions below agreed on 2026-10-11. Supersedes the payment sections of `events-plan.md`.*

## 1. Decisions

| # | Decision |
|---|---|
| 1 | **Money never passes through us.** Attendees pay the organizer directly (Click/Payme link, card transfer). We charge organizers for the software (plan to be set after the pilot). |
| 2 | **Sign-in with Telegram or email** (magic link), for organizers and attendees. |
| 3 | **Confirmation flow:** register → pay the organizer → upload the receipt screenshot → organizer confirms → ticket is issued with Add to Apple/Google Wallet. |
| 4 | **Auto-check:** the receipt is read automatically and compared with the expected payment. Clear matches can be auto-approved if the organizer turns that on. |
| 5 | **Separate repo and Vercel project: `izipass`.** The wallet project is reused as a service, not copied. |
| 6 | **No duplicated secrets.** izipass calls the wallet project's API for passes. Apple and Google credentials stay only in the wallet project. |

### Pricing (decided 2026-10-11; will change later)

| Plan | Limits | Price |
|---|---|---|
| **Free** | 2 events, up to 20 participants per event | 0 |
| **Pro** | 10 events a month, up to 100 participants per event | 299,000 so'm / month |
| **Auto-check** add-on | receipt checked automatically | 500 so'm per participant |

Free limits are read as "per month" until confirmed. Billing is manual at first (we set the plan on the organizer after they pay us); self-service billing comes later.

**Domain for now:** `izipass.myrzan.com`. Own domain after traction.

## 2. How the two projects fit together

```
izipass (new repo, izipass Vercel project)          wallet-app (existing)
┌──────────────────────────────────────┐            ┌──────────────────────────┐
│ organizers, events, registrations    │  HTTPS +   │ POST /api/v1/passes      │
│ receipts + auto-check                │  API key   │   → signed Apple .pkpass │
│ tickets, QR, check-in scanner        │ ─────────▶ │   → Google save URL      │
│ Telegram bot, email                  │            │ PassKit web service      │
│ Postgres, Blob, Upstash              │ ◀───────── │ Google callbacks         │
└──────────────────────────────────────┘  webhook   │ (already built)          │
                                                    └──────────────────────────┘
```

**izipass owns** all product data and logic. **wallet-app becomes the pass service**: it signs passes, hosts the Apple web service and Google callbacks, and tells izipass when a pass is added, updated or removed.

Env vars in izipass: database, Telegram bot token, email provider, `WALLET_API_URL` and `WALLET_API_KEY`. No AI key: auto-check runs on free OCR. Nothing from Apple or Google.

Vercel also supports **team-level shared environment variables** that can be attached to several projects. Useful for the few genuinely shared values (e.g. Upstash), but not for the Apple/Google secrets: those should exist in one project only.

### Changes needed in wallet-app

1. **`POST /api/v1/passes`** (new, API-key protected): takes a pass description and returns the Apple `.pkpass` (or a one-time download URL) and the Google save URL. Supports a new **event ticket** layout: event name, date, venue, attendee name, `relevantDate` and location so the pass appears on the lock screen, a QR code with the izipass ticket URL.
2. **Pass updates:** `PATCH /api/v1/passes/{id}` changes a pass (time or venue changed, "checked in") and pushes the update to phones (APNs for Apple, object update for Google). The device registrations from the stats work are the foundation.
3. **Webhook to izipass:** when Apple or Google report added/removed, wallet-app posts `{passId, event}` to izipass, signed with a shared secret.
4. **Shared UI:** the camera scanner and shadcn components are copied into izipass (two repos is not enough to justify a package). If a third app appears, extract `@myrzan/ui`.

## 3. Product flows

### Organizer

1. Sign in (Telegram or email). Create a profile: name, logo, description, links → `izipass.uz/<slug>`.
2. Create an event: title, cover, date and time, venue, description, capacity, price, **payment instructions** (Click/Payme link and/or card number shown to attendees), questions to ask attendees, registration deadline, payment time limit (e.g. 30 minutes).
3. Share the event link. Preview card for Telegram and Instagram.
4. Registrations arrive. Each one shows the receipt and the auto-check result. **Approve / Reject** in the dashboard or in the Telegram bot.
5. Door: open the scanner, scan tickets. Green with the name, or red with the reason.
6. After: attendance, no-shows, repeat attendees, export to CSV.

### Attendee

1. Open the event page → **Register** → sign in with Telegram or email (this is also how the ticket is delivered).
2. Answer the organizer's questions. A spot is **held** for the payment time limit.
3. See the payment instructions and the exact amount, pay in Click/Payme, upload the screenshot.
4. Status page: "Checking…" → "Confirmed". Get **Add to Apple Wallet / Google Wallet**, plus the ticket link by Telegram/email.
5. If rejected: the reason and a way to resend. If the hold expires: the spot is released, and the attendee can join the waitlist.

## 4. Receipt auto-check

Goal: the organizer rarely has to open a screenshot. Decided 2026-10-11: **no paid API** (no vision model, no API key). The check is free to run and works like this.

### Step 1: read the screenshot in the attendee's browser

When the attendee uploads the receipt, the browser runs **tesseract.js** (open-source OCR, English + Russian models, about 5 MB downloaded once and cached) on the same image and sends the recognized text to `POST /api/receipts/[id]/text`. The screenshot itself is saved first, so a slow phone or a closed tab never loses the receipt; the organizer then checks by hand as before. The OCR engine, wasm core and language data are served from our own origin (`public/tesseract`, copied on `npm install`), so there is no third-party request.

### Step 2: fields from the text (`src/lib/receipt-check.ts`, pure, tested)

- provider: Click / Payme / Uzum / Paynet / bank / unknown
- amounts: every money-looking number ("50 000,00 сум", "50,000.00 UZS", "50 000 so'm")
- date and time: `11.10.2026 14:32`, `2026-10-11 14:32`, `11 октября 2026`, `11-oktabr 2026`, `11 Oct 2026` (Tashkent time)
- card: last 4 digits of masked numbers (`8600 **** **** 1234`, `•••• 1234`)
- receipt / transaction number, status words (успешно / muvaffaqiyatli / completed vs отклонён / bekor / failed)
- common OCR slips are corrected (letter O inside numbers, ё/е)

### Step 3: rules

| Check | Pass condition |
|---|---|
| Amount | one of the amounts equals the ticket price |
| Time | paid between 2 days before registering and the upload time (a receipt without a clock time counts for its whole day) |
| Recipient | last 4 digits or name matches the organizer's payout card (skipped when the organizer has not set either) |
| Status | no failure words |
| Reference | the registration code (e.g. ESC-4821) appears in the text — informational |
| Duplicate | the same image (SHA-256) or the same receipt number was not used for another registration of this organizer |

Verdict: **passed** when amount, time and recipient pass and nothing fails; **failed** on a wrong amount, a date outside the window, another recipient, a failure status or a duplicate; otherwise **review** (something could not be read).

### Step 4: decision

- Organizer setting *Enable auto-check* (the paid add-on, 500 so'm per checked participant; `checked_at` on receipts is the billing counter).
- Organizer setting *Confirm automatically when every check passes*: a passing receipt confirms the spot and the ticket appears at once; otherwise the organizer still approves, with the verdict and the failed checks shown next to the receipt.
- Nothing is ever auto-rejected: a failed check leaves the registration for the organizer.

### What this cannot do

A screenshot can be edited, and so can the OCR text the browser sends. Auto-check catches sloppy fraud (wrong amount, reused receipt, old date) and removes the routine work, but it can't prove money arrived. Only the organizer's own Click/Payme history can. The organizer always sees the screenshot and can reverse any decision. For the pilot, we recommend auto-check without auto-confirm for the first two events, then auto-confirm.

### Data

Every receipt keeps the OCR text, the parsed fields, the verdict and the checks, next to the organizer's decision. That dataset shows where OCR misreads receipts and which rules cause false "review" results, so the parser can be tuned on real receipts from Click, Payme and the banks.

## 5. Tickets and check-in

- **QR content:** `https://izipass.uz/t/<ticketId>.<signature>`, signed with an izipass secret. Forgery-proof, and a normal camera scan opens the ticket page.
- **Wallet pass:** requested from wallet-app with the event ticket layout. Pass ids are stored so updates (time change, "checked in") can be pushed.
- **Scanner page** (organizer's phone): downloads the event's ticket list on open, verifies the signature locally, works without internet, syncs check-ins later. Double scans on two phones are reconciled on sync.
- **Check-in rules:** valid signature, right event, status confirmed, not already used.

## 6. Stack

| Need | Choice |
|---|---|
| App | Next.js 16, shadcn/ui, same conventions as wallet-app |
| Database | Postgres (Neon via Vercel Marketplace) + Drizzle |
| Auth | Telegram Login Widget (signed data) + email magic links (Resend). Sessions in signed cookies |
| Files | Vercel Blob: covers (public), receipts (private, deleted 30 days after the event) |
| Receipt reading | Anthropic SDK, structured output |
| Telegram bot | Webhook route; approve/reject buttons; ticket delivery |
| Email | Resend: magic links, confirmations, tickets |
| Jobs | Vercel Cron: expire holds, promote waitlist, reminders, delete old receipts |
| Rate limits, counters | Upstash Redis |
| Passes | wallet-app API |

## 7. Data model

- `users` (id, telegram_id?, email?, name, locale)
- `organizers` (slug, name, logo, description, links, owner user, payout card last4 + name for auto-check, plan)
- `organizer_members` (organizer, user, role: owner | staff)
- `events` (organizer, title, cover, starts_at, ends_at, venue, description, capacity, price, payment_instructions, hold_minutes, auto_approve, status)
- `questions` (event, label, type, required)
- `registrations` (event, user, answers, status: `held → proof_sent → confirmed | rejected | expired | cancelled | waitlist`, reference code, hold_expires_at, checked_in_at, checked_in_by)
- `receipts` (registration, blob url, extracted JSON, rule results, decision, decided_by: auto | user id)
- `tickets` (registration, qr token, apple pass id, google object id, added_at, removed_at)
- `audit_log` (who did what, when)

## 8. Build order

1. **Repo and foundation:** new `izipass` repo, Vercel project, Postgres, Drizzle, auth (Telegram + email), i18n copied from wallet-app.
2. **Organizers and events:** profile page, event CRUD, public event page with OG image.
3. **Registration:** holds, questions, payment instructions page, receipt upload, Cron for expiries, waitlist.
4. **Organizer review:** registrations list, approve/reject, Telegram bot notifications with buttons.
5. **wallet-app API:** `/api/v1/passes` with event ticket layout and API key; izipass issues tickets; ticket page and QR.
6. **Check-in scanner** with offline list.
7. **Auto-check:** extraction, rules, decision, logging; organizer setting.
8. **Pass updates and webhook** (time changes, added/removed).
9. **Pilot** with 3–5 clubs; set pricing.

## 9. Open items

- Brand language for the first version: uz / ru / en, Kazakh later?
- Telegram bot name.
- Whether attendees may register without an account (name + phone only) as a fallback for people without Telegram or email.
