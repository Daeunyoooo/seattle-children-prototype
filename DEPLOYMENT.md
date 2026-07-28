# Vercel + Supabase Deployment

Cross-device participant save/load for the free prototype path.

**Not for PHI/HIPAA.** The Supabase anon key can read and write all session rows. Use only for non-sensitive prototype testing.

## 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run [`supabase/migrations/001_participant_sessions.sql`](supabase/migrations/001_participant_sessions.sql).
3. In **Project Settings → API**, copy:
   - Project URL → `VITE_SUPABASE_URL`
   - `anon` `public` key → `VITE_SUPABASE_ANON_KEY`

## 2. Local env

```bash
cp .env.example .env
```

Fill in the two `VITE_SUPABASE_*` values, then:

```bash
npm install
npm run dev
```

The app talks to Supabase over the PostgREST API (no extra npm package required). With env vars set, autosave writes to Supabase. Researcher `/researcher` can load by participant ID from another device.

Without env vars, behavior stays localStorage-only (same as GitHub Pages).

## 3. Vercel

1. Import this GitHub repo at [vercel.com](https://vercel.com).
2. Framework preset: Vite (or Other). Build command: `npm run build`. Output: `dist`.
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. SPA routes (`/researcher`) are covered by [`vercel.json`](vercel.json).

## 4. Smoke test

1. Device A: open the Vercel URL, enter a participant ID, complete some answers (autosave).
2. Device B: open `/researcher`, enter the same ID, **Load draft**.
3. Download Phase 1 / Phase 2 JSON to confirm cross-device export.

## Related

- GitHub Pages remains local-only: see [`GITHUB_PAGES_DEPLOYMENT.md`](GITHUB_PAGES_DEPLOYMENT.md).
- Posit Connect / DuckDB path is unchanged: see [`connect/README.md`](connect/README.md).
