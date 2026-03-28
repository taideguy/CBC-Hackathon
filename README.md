# DockCheck

Verify any carrier's legitimacy before releasing freight. DockCheck pulls live FMCSA data, runs 6 signal checks, and generates a plain-English risk summary — in under 10 seconds.

Built for the CBC Hackathon.

---

## What it does

**Carrier lookup** — Enter a DOT or MC number. DockCheck fetches live data from the FMCSA QCMobile API and scores 6 signals:

1. **Authority** — Operating status and common/contract authority
2. **Insurance** — BIPD and cargo insurance on file; flags policies expiring within 30 days
3. **Safety Rating** — Satisfactory / Conditional / Unsatisfactory
4. **Ownership** — Detects mismatches against prior snapshots; tracks registration change velocity
5. **Out of Service** — Flags active OOS orders
6. **BASIC Scores** — SMS percentile flags across 7 behavior categories
7. **Cargo Fit** (optional) — Detects mismatches between selected commodity and carrier's declared cargo types

Each signal returns `ok`, `warn`, or `danger`. The overall verdict is derived from the worst signal.

**AI risk summary** — A streaming Claude-generated plain-English summary of what the signals mean for the specific load context, including any cargo mismatches.

**Watchlist** — Save carriers to a persistent watchlist. Tap any saved carrier to automatically re-run a fresh lookup. Watchlist items show last verdict and time since last check.

**Ownership history** — If a carrier has been looked up before, shows a chronological log of detected ownership changes (legal name, address, phone, EIN).

**Overnight diff** — A Vercel cron job runs at 3 AM daily, diffs the FMCSA CENSUS bulk files for watched carriers, and writes any changes to the `ownership_events` table.

---

## Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 + CSS custom properties
- **AI**: Anthropic Claude API (streaming)
- **Database**: Supabase (Postgres)
- **Scheduling**: Vercel Cron Jobs
- **Icons**: Lucide React

---

## Project structure

```
src/
  app/
    api/
      carrier/        POST — FMCSA lookup + scoring + streaming AI summary
      watchlist/      GET, POST — watchlist CRUD
      watchlist/[id]/ DELETE
      ownership/      GET — ownership event history for a DOT
      cron/diff/      POST — overnight bulk file diff (Vercel cron)
    page.tsx          Main app (verify + watchlist tabs)
    layout.tsx        Phone-frame desktop wrapper
    globals.css       Design tokens + animations
  components/
    SearchBar.tsx     DOT/MC input with streaming result handler
    VerdictCard.tsx   Hero verdict display
    SignalList.tsx    6-signal grid with tap-to-expand on Insurance + Ownership
    RiskSummary.tsx   Streaming AI summary
    WatchlistItem.tsx Swipeable watchlist row
    BottomNav.tsx     Verify / Watchlist tab nav
  lib/
    fmcsa.ts          All FMCSA API calls (mock data in dev)
    scoring.ts        Signal scoring + verdict derivation (pure functions)
    claude.ts         Claude API streaming
    db.ts             All Supabase queries
    fleet.ts          Fleet profile builder (FMCSA inspections + NHTSA VIN decode)
    diff.ts           FMCSA bulk file diff logic
    alerts.ts         SMS (Twilio) + email (Resend) alerts
  types/
    index.ts          Shared TypeScript types
```

---

## Local development

1. Copy `.env.example` to `.env.local` and fill in your keys:

```
FMCSA_API_KEY=
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
RESEND_API_KEY=
```

2. Install and run:

```bash
npm install
npm run dev
```

In development, FMCSA calls return mock data so you don't burn API quota.

---

## Supabase schema

```sql
create table carrier_snapshots (
  dot_number text,
  snapshot_date date,
  legal_name text,
  physical_address text,
  phone text,
  ein text,
  insurance_cancellation_date date,
  raw_json jsonb,
  primary key (dot_number, snapshot_date)
);

create table watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  dot_number text not null,
  carrier_name text not null,
  mc_number text,
  alert_phone text,
  alert_email text,
  last_verdict text,
  last_checked timestamptz,
  added_at timestamptz default now(),
  unique (user_id, dot_number)
);

create table ownership_events (
  id uuid primary key default gen_random_uuid(),
  dot_number text not null,
  detected_at timestamptz default now(),
  field_changed text not null,
  old_value text,
  new_value text,
  alerted boolean default false
);

create table fleet_profiles (
  dot_number text primary key,
  top_makes text[],
  avg_model_year int,
  unit_count int,
  last_updated timestamptz default now()
);
```
