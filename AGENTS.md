# AGENTS.md - wolfstar-cdn

## Project Overview

A Cloudflare Worker-based CDN for image delivery and transformation. Serves images from R2 storage with on-the-fly Cloudflare Image Transformations, caching, CORS, rate limiting, and security headers.

## Tech Stack

- **Runtime:** Cloudflare Workers (Nitro v3, cloudflare_module preset)
- **Framework:** Nitro v3 / h3
- **Build:** Vite 8 + nitro/vite plugin
- **Storage:** Cloudflare R2
- **Rate Limiting:** Cloudflare Rate Limit binding (direct env.RATE_LIMITER.limit())
- **Logging:** evlog (structured wide events via evlog/nitro/v3)
- **Language:** TypeScript 5.9
- **Package Manager:** pnpm 10.31
- **Formatter:** Oxfmt 0.46 (tabs, lineWidth 140, LF, single quotes, trailing commas)
- **Linter:** Biome (default rules)
- **Test Runner:** None configured
- **Deploy:** `vite build && wrangler deploy`

## Conventions

- **Style:** camelCase for variables/functions, PascalCase for types/interfaces
- **Quotes:** Single quotes
- **Semicolons:** Always
- **Indent:** Tabs (width 2)
- **Line Endings:** LF
- **Line Width:** 140
- **Trailing Commas:** All
- **Imports:** Organized via Biome assist

## File Structure

```
nitro.config.ts    -- Nitro config (preset, cloudflare bindings, wrangler config)
vite.config.ts     -- Vite config (nitro plugin)
server/
  error.ts         -- Global error handler (defineErrorHandler)
  middleware/
    01-cors.ts     -- CORS middleware (handleCors, dynamic origin validation)
    02-rate-limiter.ts -- Rate limiting (Cloudflare binding, 20 req/60s)
    03-cache.ts    -- Cache-read middleware (Cloudflare Cache API, HIT path)
  plugins/
    security-headers.ts -- Security headers (nosniff, DENY, XSS-Protection)
    cache-writer.ts -- Cache-write plugin (MISS path, response hook)
  routes/
    health.get.ts  -- Health check endpoint
    [...path].ts   -- Catch-all CDN route (R2 fetch, image transforms, range)
  utils/
    types.ts       -- Type definitions (CfImageTransformOptions, etc.)
    constants.ts   -- Constants (image extensions, dimension limits, cache TTL)
    errors.ts      -- Error response factory
    r2.ts          -- R2 utilities (fetch, transform, range, parse)
```

## Cloudflare Bindings

- `wolfstar_cdn` -- R2Bucket
- `RATE_LIMITER` -- RateLimit
- `ALLOWED_ORIGINS` -- env var (comma-separated origins)
- `R2_WORKER_URL` -- env var

## Key Behaviors

- Cache-aside pattern via Cloudflare Cache API (split read/write: middleware + plugin)
- Cloudflare Image Transformations via `fetch(url, { cf: { image } })` on RequestInit
- Range request support for non-transformed files
- Immutable caching (1 year) for assets
- Dynamic CORS origin validation
- Rate limiting via Cloudflare binding (20 req/60s)
- Filesystem middleware executes in alphabetical order (01-cors, 02-rate-limiter, 03-cache)
- Middleware short-circuits by returning a Response; continues by returning undefined
- Structured request logging via evlog wide events (useLogger in route handlers)

## Plan Directory

`.atlas/plans/`

## Quality Gates

format: `oxfmt` | lint: `biome check .` | typecheck: `tsc --noEmit`
