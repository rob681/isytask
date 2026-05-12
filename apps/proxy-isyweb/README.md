# @isytask/proxy-isyweb

Tier 2 (Playwright proxy) + Tier 3 (Screenshot) server for Isyweb.

Runs separately from the Next.js app because Playwright requires a Chromium
binary that doesn't fit Vercel serverless. Deploy to **Railway**, **Fly.io**
or any Node-compatible host with disk space (~300MB for browser).

## Why a separate service?

The Isyweb embed strategy has three tiers:

| Tier | What | Where it runs |
|---|---|---|
| 1 — Script | Admin pastes `<script>` on their dev site | The dev site |
| 2 — Proxy | We fetch dev site, strip CSP/X-Frame-Options, inject widget | **THIS service** |
| 3 — Screenshots | We capture multi-viewport screenshots | **THIS service** |

Tier 1 covers ~90% of cases; Tiers 2 & 3 are the fallback safety net.

## Endpoints

```
GET  /health                          → liveness
POST /proxy                           → returns rewritten HTML (Tier 2)
     body: { url, projectKey, viewport? }
POST /screenshot                      → returns image bytes (Tier 3)
     body: { url, viewport?, fullPage?, format?, quality? }
```

All endpoints (except `/health`) require:
```
Authorization: Bearer ${PROXY_SHARED_SECRET}
```

## Env vars

| Var | Required | Description |
|---|---|---|
| `PORT` | no (default 8787) | HTTP port |
| `PROXY_SHARED_SECRET` | **yes in prod** | Auth token shared with the Next.js app |
| `ISYWEB_WIDGET_URL` | no | Where to fetch the widget JS (default: prod URL) |

## Local dev

```bash
pnpm --filter @isytask/proxy-isyweb install
pnpm --filter @isytask/proxy-isyweb exec playwright install chromium
pnpm --filter @isytask/proxy-isyweb dev
```

Then in `apps/web/.env.local`:

```
PROXY_ISYWEB_URL="http://localhost:8787"
PROXY_SHARED_SECRET="dev-secret-change-me"
```

## Deployment

### Railway
1. New project → "Deploy from GitHub repo" → select `rob681/isytask`
2. Root directory: `apps/proxy-isyweb`
3. Build command: `pnpm install --frozen-lockfile && pnpm exec playwright install chromium`
4. Start command: `pnpm start`
5. Env vars: `PROXY_SHARED_SECRET` (generate with `openssl rand -hex 32`)
6. Copy the public URL → set as `PROXY_ISYWEB_URL` in Vercel env

### Fly.io
Use the included `fly.toml` if present, or:
```
fly launch --no-deploy
fly secrets set PROXY_SHARED_SECRET=...
fly deploy
```

## Status

- ✅ Tier 2 proxy implementation
- ✅ Tier 3 screenshot implementation
- ⏳ Not yet integrated into the Next.js app — when a project's
  `embedMethod` is `PROXY` or `SCREENSHOT`, the review editor should call
  this service. Wiring is pending.
- ⏳ Auto-detection fallback (try iframe → if blocked, switch to Tier 2)
  is also pending.
