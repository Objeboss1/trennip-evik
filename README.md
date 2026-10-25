# Treeningpäevik

A training diary with sign-in. Each account has its own calendar, exercises, training plan, and nutrition notes. The start page is a month calendar with today's date and a live clock. Today and future dates open a day view with four choices. Past dates keep a saved mark and cannot be changed.

Sign-in uses the existing Supabase project. The browser keeps that account's diary immediately. Sync between devices needs the `paevikud` table: run `supabase/migrations/20261023121500_paevikud.sql` once in the Supabase SQL editor. To point at another project, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` before the build.

## Run locally

```bash
npm install
npm run dev
```

The dev server listens on `0.0.0.0:43123`. Open [http://127.0.0.1:43123](http://127.0.0.1:43123).
