# FORM

> Sports as art. Pick the week, see the room, compose the plate.

A weekly WNBA picks PWA with share cards and a live leaderboard. Vanilla JS
(ES modules), no framework, no build step for the app itself — just a static
site that speaks to Supabase when configured and falls back to localStorage
when it isn't.

## Stack

- Static multi-page site (`index.html`, `you.html`, `wall.html`, `atlas.html`,
  `atlas-admin.html`)
- Vanilla ES modules under `src/`
- Service worker + web manifest (installable PWA)
- Supabase for auth, leaderboard, wall posts, share-card hosting
- ESPN scoreboard API for live results

## Quickstart

```bash
npm install
./dev.sh            # serves on http://localhost:8080
./dev.sh stop
./dev.sh status
```

The app runs fully without Supabase (localStorage-only). To enable auth +
leaderboard + wall, put your project values in `config.js`:

```js
window.SUPABASE_URL = 'https://<project>.supabase.co';
window.SUPABASE_ANON_KEY = '<anon-public-key>';
```

`config.js` is gitignored. `config.example.js` is the committed template.

## Deploy to Vercel

This repo is configured for Vercel static deployment. `config.js` is generated
at build time from project environment variables, so no secrets need to live
in git.

1. Import the repo in Vercel (Add New → Project → pick the GitHub repo).
2. Framework preset: **Other** (Vercel will read `vercel.json`).
3. Add **Environment Variables**:
   - `SUPABASE_URL` — your project URL
   - `SUPABASE_ANON_KEY` — your anon/public key
4. Deploy.

The `npm run build` step (configured in `vercel.json`) runs
`scripts/build-config.mjs`, which materializes `config.js` from the env vars.
If the vars are absent, the app still deploys — it just runs in
localStorage-only mode.

### Headers Vercel applies

Defined in `vercel.json`:

- `sw.js`, `config.js`, `*.html` — `Cache-Control: max-age=0, must-revalidate`
  so PWA updates land immediately.
- `icons/*` — cached 7 days, immutable.
- `manifest.webmanifest` — correct `application/manifest+json` content type.
- Security headers (`X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`) on everything.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start local static server on `:8080` (`dev.sh`) |
| `npm run stop` | Stop local static server |
| `npm run build` | Generate `config.js` from env vars (used by Vercel) |
| `npm run ingest:results` | Ingest finished-game results into Supabase (`scripts/ingest-results.mjs`) |

## Layout

```
index.html            Picks (home)
you.html              Your running form
wall.html             Community wall
atlas.html            Atlas gallery
atlas-admin.html      Admin UI for Atlas
config.js             Local Supabase config (gitignored)
config.example.js     Template
vercel.json           Static deploy config
sw.js                 Service worker (cache strategy)
manifest.webmanifest  PWA manifest
scripts/
  build-config.mjs    Writes config.js from env at build time
  ingest-results.mjs  Pulls final scores -> Supabase
src/
  main.js             Picks page entry
  main-you.js         You page entry
  main-wall.js        Wall page entry
  main-atlas.js       Atlas page entry
  main-atlas-admin.js Admin entry
  supabase.js         Supabase client (lazy, optional)
  auth.js / auth-ui.js
  state.js            Picks + week state (localStorage + Supabase sync)
  share.js            Share-card composer
  artwork.js          Row artwork
  leaderboard.js
  wall-posts.js
  notifications.js
  pwa.js              SW registration + install prompts
  atlas/              Atlas renderer + shapes
  data/               Static entity/event metadata
supabase/migrations/  Schema + RLS
```

## PWA notes

- `sw.js` uses cache-first for the app shell, stale-while-revalidate for
  static data, and network-only for API calls (Supabase, ESPN).
- Bump `CACHE_VERSION` inside `sw.js` whenever shell assets change so old
  caches are cleared on activate.
