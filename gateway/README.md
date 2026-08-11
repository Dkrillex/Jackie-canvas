# Tennda Gateway

Minimal reverse proxy that maps public `tennda-*` model ids to real upstream wire names before forwarding to gravitex.

```text
browser  -- model: tennda-illusion -->  gateway  -- model: gpt-image-2 -->  api.gravitex.ai
```

## Run (local)

```bash
cd gateway
node server.js
```

Default: `http://127.0.0.1:8787`. Vite (`web/`) proxies `/gw` here in development.

## Env

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `8787` | Listen port |
| `GW_UPSTREAM` | `https://api.gravitex.ai` | Upstream OpenAI-compatible API |
| `GW_STRIP_PREFIX` | `/gw` | Path prefix stripped before forwarding |

## Mapping

Edit `model-map.js` (keep in sync with `web/src/constant/tennda-models.ts`).

## Production (Vercel)

**Do not deploy this Node server on Vercel.** Production uses root `middleware.js` (Edge Middleware), which imports `gateway/rewrite.js` + `gateway/model-map.js` and proxies `/gw` → gravitex with the same model rewrite.

Deploy the repo as usual (Root Directory = repo root, `vercel.json` builds `web/`). Ensure:

1. Root `middleware.js` is included in the deployment (not gitignored).
2. `vercel.json` must **not** rewrite `/gw` directly to gravitex — that would bypass model mapping. SPA fallback should exclude `gw/` and `prod-api/`.
3. After deploy, Network → `/gw` request body shows `tennda-*`; generation still works.

Local `node server.js` is only for Vite dev (`web/vite.config.ts` proxies `/gw` → `127.0.0.1:8787`).
