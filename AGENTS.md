# Core Requirements

- The end goal is stability, speed, and security.
- wolfstar-cdn is a Cloudflare Worker-based CDN for image delivery and on-the-fly transformation. It serves assets from R2 storage with Cloudflare Image Transformations, cache-aside caching, CORS, rate limiting, and security headers. Built with Nitro v3 and TypeScript.
- Always reference these instructions first and fall back to search or documentation queries only when you encounter unexpected information.

## Code Quality Requirements

- Follow strict TypeScript conventions; never cast to `any` or use non-null assertions without a `// oxlint-disable-next-line` explanation comment
- Ensure you write strictly type-safe code — always check array index accesses and optional chain where appropriate
- Use `createErrorResponse` from `server/utils/errors.ts` for all error responses; never construct raw error `Response` objects inline
- Use `UPPER_SNAKE_CASE` constants from `server/utils/constants.ts`; never hardcode magic numbers or extension strings
- Keep functions focused and under 50 lines; extract pure helpers to `server/utils/`
- Add comments only to explain non-obvious Cloudflare-specific behavior (e.g. `caches.default`, `waitUntil`, `cf.image`)
- Accessibility and security are first-class: validate all user-supplied query parameters before use; never trust client input

## Naming Conventions

| Type               | Convention       | Example                         |
| ------------------ | ---------------- | ------------------------------- |
| Directories        | kebab-case       | `server/middleware/`            |
| TypeScript files   | kebab-case       | `cache-writer.ts`               |
| Route files        | kebab-case       | `health.get.ts`, `[...path].ts` |
| Variables          | camelCase        | `objectKey`, `rangeHeader`      |
| Constants          | UPPER_SNAKE_CASE | `IMMUTABLE_CACHE_TTL`           |
| Types / Interfaces | PascalCase       | `CfImageTransformOptions`       |
| Functions          | camelCase        | `parseTransformations`          |

## Development Commands

```bash
pnpm dev              # Nitro dev server (local Workers emulation)
pnpm build            # Production build via Vite + Nitro
pnpm deploy           # Deploy prebuilt output via wrangler
pnpm lint             # Run oxlint + oxfmt check (no auto-fix)
pnpm lint:fix         # Run oxlint --fix && oxfmt (auto-fix)
pnpm typecheck        # tsc --noEmit (must pass with zero errors)
```

## File Structure

```
nitro.config.ts    -- Nitro config (preset, cloudflare bindings, wrangler config)
vite.config.ts     -- Vite config (nitro plugin)
server/
  error.ts         -- Global error handler (defineErrorHandler)
  middleware/
    01.cors.ts     -- CORS middleware (handleCors, dynamic origin validation)
    02.rate-limiter.ts -- Rate limiting (Cloudflare binding, 20 req/60s)
    03.cache.ts    -- Cache-read middleware (Cloudflare Cache API, HIT path)
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

| Binding           | Kind      | Description                                   |
| ----------------- | --------- | --------------------------------------------- |
| `wolfstar_cdn`    | R2Bucket  | Primary asset storage                         |
| `RATE_LIMITER`    | RateLimit | 20 requests per 60 s per IP                   |
| `ALLOWED_ORIGINS` | env var   | Comma-separated list of allowed origins       |
| `R2_WORKER_URL`   | env var   | Base URL used when constructing fetch targets |

Access bindings via `event.req.runtime!.cloudflare!.env`. Always add the standard `// oxlint-disable-next-line typescript/no-non-null-assertion` comment above these accesses.

## Middleware Patterns

- Middleware files execute in alphabetical order: `01.cors` -> `02.rate-limiter` -> `03.cache`
- Return a `Response` to short-circuit the chain; return `undefined` to continue to the next middleware
- Never throw from middleware; always return an explicit `Response` for error cases

```ts
// short-circuit pattern
export default defineHandler(async (event) => {
	const { env } = event.req.runtime!.cloudflare!;
	// ... logic
	if (shouldBlock) return new Response(/* ... */);
	return undefined; // continue chain
});
```

## Route Patterns

- All routes use `defineHandler` from `nitro`
- Access the environment via `event.req.runtime!.cloudflare!.env`
- Use `createErrorResponse(code, message, status)` for all error exits
- Attach structured log fields with `log.set({})` before the async operation; log errors with `log.error(err, { step })`

```ts
import { useLogger } from 'evlog/nitro/v3';
import { defineHandler } from 'nitro';
import { createErrorResponse } from '../utils/errors';

export default defineHandler(async (event) => {
	const log = useLogger(event);
	// oxlint-disable-next-line typescript/no-non-null-assertion -- We are confident that these properties will be available in the Cloudflare Workers environment
	const { env } = event.req.runtime!.cloudflare!;

	log.set({ key: 'value' });

	try {
		// ... handler logic
	} catch (error) {
		log.error(error as Error, { step: 'descriptive-step-name' });
		return createErrorResponse('ERROR_CODE', 'Human-readable message', 500);
	}
});
```

## Cache Patterns

The cache is split across two files to separate the read (HIT) path from the write (MISS) path:

- **`03.cache.ts` (middleware)** — checks `caches.default` for a match; returns the cached `Response` with `X-Cache-Status: HIT` if found; stores the constructed `Request` cache key on `event.context._cacheKey` for the plugin to use
- **`cache-writer.ts` (plugin)** — hooks `nitroApp.hooks.hook('response', ...)` to write successful `2xx GET` responses into `caches.default` via `waitUntil`; sets `X-Cache-Status: MISS`

Rules:

- Skip caching for `HEAD` requests and non-`2xx` responses
- Always use `event.req.waitUntil?.()` when calling `cache.put` so it does not block response delivery
- The `/health` route is excluded from cache reads and writes

## Image Transformation Patterns

- Call `parseTransformations(pathname, searchParams)` from `server/utils/r2.ts`; it returns `CfImageTransformOptions | null`
- Transformation is triggered only when the file extension is in `IMAGE_EXTENSIONS` **and** at least one transform param (`w`, `h`, `q`, `fit`, `f`) is present
- Range requests and image transformations are mutually exclusive; return `400` if both are present
- All dimension and quality values are validated against `MIN_IMAGE_DIMENSION`, `MAX_IMAGE_DIMENSION`, `MIN_QUALITY`, `MAX_QUALITY` before use
- Unsupported `f` (format) values silently fall back to no transformation when no other valid params are present

## Logging Patterns

All structured request logging uses `evlog` wide events via the Nitro v3 adapter.

```ts
import { useLogger } from 'evlog/nitro/v3';

const log = useLogger(event);

// Attach key/value pairs to the request-scoped wide event
log.set({ r2: { key: objectKey, transform: transformOptions !== null } });

// Log errors with contextual step information
log.error(error as Error, { step: 'fetchFromR2' });
```

- Call `useLogger(event)` once at the top of each route handler
- Prefer `log.set()` for non-error structured fields; use `log.error()` only for caught exceptions
- Never use `console.log` in route handlers or middleware; `console.error` is acceptable only in plugin hooks where `useLogger` is unavailable

## Pre-commit Checklist

Before committing changes, always run:

1. `pnpm build` — must build successfully with zero errors
2. `pnpm lint:fix` — fix all lint and format errors
3. `pnpm typecheck` — must pass with zero type errors

Commit messages must follow Conventional Commits: `<type>(<scope>): <subject>`

## Troubleshooting

- **Build errors:** Delete `.nitro`, `.output`, and `node_modules/.cache`, then rebuild
- **Type errors after Nitro updates:** Run `pnpm install` and verify `nitro.config.ts` preset is `cloudflare_module`
- **Wrangler deploy fails:** Ensure `wrangler.jsonc` bindings match the Cloudflare dashboard configuration exactly
- **`caches.default` undefined locally:** The Cache API is only available in the Cloudflare Workers runtime; wrap in `try/catch` or skip in local dev
- **CORS rejected:** Verify the origin is listed in the `ALLOWED_ORIGINS` env var (comma-separated, no trailing spaces)
- **Rate limit not triggering:** Confirm the `RATE_LIMITER` binding is declared in `wrangler.jsonc` under `[[unsafe.bindings]]` with the correct namespace

**When in doubt:** Copy existing patterns from similar files (e.g., `server/middleware/03.cache.ts`, `server/routes/[...path].ts`) before inventing new ones.

## Plan Directory

`.atlas/plans/`

## Quality Gates

format: `oxfmt` | lint: `oxlint` | typecheck: `tsc --noEmit`
