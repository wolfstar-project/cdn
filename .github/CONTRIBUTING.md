# Contributing to wolfstar-cdn

Thank you for your interest in contributing! This document provides guidelines
and instructions for contributing.

> **Important** Please be respectful and constructive in all interactions. We
> aim to maintain a welcoming environment for all contributors.

## Goals

The goal of wolfstar-cdn is to build a fast, secure, and reliable CDN worker
for the WolfStar Network, prioritizing stability, speed, and a clean developer
experience.

### Core values

- Stability and reliability
- Type safety and code quality
- Speed and performance

### Target audience

wolfstar-cdn is built for the WolfStar Network infrastructure team responsible
for serving and transforming images from Cloudflare R2 storage.

## Table of Contents

- [Getting started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Setup](#setup)
- [Development workflow](#development-workflow)
  - [Available commands](#available-commands)
  - [Project structure](#project-structure)
- [Code style](#code-style)
  - [TypeScript](#typescript)
  - [Route patterns](#route-patterns)
  - [Middleware patterns](#middleware-patterns)
  - [Image transformation patterns](#image-transformation-patterns)
  - [Naming conventions](#naming-conventions)
- [Submitting changes](#submitting-changes)
  - [Before submitting](#before-submitting)
  - [Pull request process](#pull-request-process)
  - [Commit messages and PR titles](#commit-messages-and-pr-titles)
  - [PR descriptions](#pr-descriptions)
- [Pre-commit hooks](#pre-commit-hooks)
- [Using AI](#using-ai)
- [Questions?](#questions)
- [License](#license)

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 22+ (LTS)
- [pnpm](https://pnpm.io/) 10+ (required -- not npm or yarn)
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) 4+ (Cloudflare
  CLI)
- A [Cloudflare account](https://dash.cloudflare.com/) with R2 storage enabled

### Setup

1. Fork and clone the repository

   ```bash
   git clone https://github.com/wolfstar-project/cdn.git
   cd cdn
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Configure Cloudflare bindings

   Open `wrangler.jsonc` and update the required values:

   Required bindings:
   - `wolfstar_cdn` -- R2 bucket name bound to your Cloudflare R2 bucket
   - `RATE_LIMITER` -- Rate limit namespace ID (20 req / 60 s per IP)
   - `ALLOWED_ORIGINS` -- Comma-separated list of allowed CORS origins
   - `R2_WORKER_URL` -- Base URL used when constructing fetch targets

   > **Note** Secrets (tokens, sensitive values) must be added via
   > `wrangler secret put <NAME>` and must **never** be committed to the
   > repository.

4. Start the local dev server:

   ```bash
   pnpm dev
   ```

   > **Note** The Cloudflare Cache API (`caches.default`) and rate limiting
   > bindings are only available inside the Cloudflare Workers runtime. Some
   > features will be skipped or no-op locally.

## Development workflow

### Available commands

```bash
# Development
pnpm dev              # Nitro dev server (local Workers emulation)
pnpm build            # Production build via Vite + Nitro
pnpm deploy           # Deploy prebuilt output via wrangler

# Code quality
pnpm lint             # Run oxlint + oxfmt check (no auto-fix)
pnpm lint:fix         # Run oxlint --fix && oxfmt (auto-fix)
pnpm typecheck        # tsc --noEmit (must pass with zero errors)
```

### Project structure

```text
nitro.config.ts          -- Nitro config (preset, cloudflare bindings, wrangler config)
vite.config.ts           -- Vite config (nitro plugin)
wrangler.jsonc           -- Wrangler deployment and bindings configuration
server/
  error.ts               -- Global error handler (defineErrorHandler)
  middleware/
    01.cors.ts           -- CORS middleware (handleCors, dynamic origin validation)
    02.rate-limiter.ts   -- Rate limiting (Cloudflare binding, 20 req/60s)
    03.cache.ts          -- Cache-read middleware (Cloudflare Cache API, HIT path)
  plugins/
    security-headers.ts  -- Security headers (nosniff, DENY, XSS-Protection)
    cache-writer.ts      -- Cache-write plugin (MISS path, response hook)
  routes/
    health.get.ts        -- Health check endpoint
    [...path].ts         -- Catch-all CDN route (R2 fetch, image transforms, range)
  utils/
    types.ts             -- Type definitions (CfImageTransformOptions, etc.)
    constants.ts         -- Constants (image extensions, dimension limits, cache TTL)
    errors.ts            -- Error response factory
    r2.ts                -- R2 utilities (fetch, transform, range, parse)
```

## Code style

When committing changes, try to keep an eye out for unintended formatting
updates. These can make a pull request look noisier than it really is and slow
down the review process.

The project uses `oxfmt` to handle formatting. If you want to get ahead of any
formatting issues, run `pnpm lint:fix` before committing.

### TypeScript

- Never cast to `any` or use non-null assertions without a
  `// oxlint-disable-next-line typescript/no-non-null-assertion` explanation
  comment directly above the line
- Always check array index accesses and optional chain where appropriate
- Use `UPPER_SNAKE_CASE` constants from `server/utils/constants.ts`; never
  hardcode magic numbers or file extension strings
- Use `type` imports for type-only values: `import type { ... } from "..."`
- Always use `createErrorResponse` from `server/utils/errors.ts` for error
  responses; never construct raw error `Response` objects inline
- Add comments only to explain non-obvious Cloudflare-specific behavior (e.g.
  `caches.default`, `waitUntil`, `cf.image`)

### Route patterns

All routes use `defineHandler` from `nitro`. Access the environment via the
Cloudflare runtime binding and use structured logging throughout:

```typescript
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

### Middleware patterns

Middleware files execute in alphabetical order:
`01.cors` -> `02.rate-limiter` -> `03.cache`

- Return a `Response` to short-circuit the chain
- Return `undefined` to continue to the next middleware
- Never throw from middleware; always return an explicit `Response` for error
  cases

```typescript
export default defineHandler(async (event) => {
	// oxlint-disable-next-line typescript/no-non-null-assertion -- We are confident that these properties will be available in the Cloudflare Workers environment
	const { env } = event.req.runtime!.cloudflare!;
	if (shouldBlock) return new Response(/* ... */);
	return undefined; // continue chain
});
```

### Image transformation patterns

- Call `parseTransformations(pathname, searchParams)` from `server/utils/r2.ts`
- Transformation is triggered only when the file extension is in
  `IMAGE_EXTENSIONS` **and** at least one transform param (`w`, `h`, `q`,
  `fit`, `f`) is present
- Range requests and image transformations are mutually exclusive; return `400`
  if both are present
- All dimension and quality values are validated against `MIN_IMAGE_DIMENSION`,
  `MAX_IMAGE_DIMENSION`, `MIN_QUALITY`, and `MAX_QUALITY` before use

### Naming conventions

| Type               | Convention       | Example                         |
| ------------------ | ---------------- | ------------------------------- |
| Directories        | kebab-case       | `server/middleware/`            |
| TypeScript files   | kebab-case       | `cache-writer.ts`               |
| Route files        | kebab-case       | `health.get.ts`, `[...path].ts` |
| Variables          | camelCase        | `objectKey`, `rangeHeader`      |
| Constants          | UPPER_SNAKE_CASE | `IMMUTABLE_CACHE_TTL`           |
| Types / Interfaces | PascalCase       | `CfImageTransformOptions`       |
| Functions          | camelCase        | `parseTransformations`          |

## Submitting changes

### Before submitting

1. Ensure your code follows the style guidelines above
2. Run the full pre-commit checklist:

   ```bash
   pnpm build        # must build successfully with zero errors
   pnpm lint:fix     # fix all lint and format errors
   pnpm typecheck    # must pass with zero type errors
   ```

### Pull request process

1. Create a feature branch from `main`
2. Make your changes with clear, descriptive commits
3. Push your branch and open a pull request
4. Ensure CI checks pass (lint, typecheck, build)
5. Request review from maintainers

### Commit messages and PR titles

Write clear, concise PR titles that explain the "why" behind changes.

We use [Conventional Commits](https://www.conventionalcommits.org/). Since we
squash on merge, the PR title becomes the commit message in `main`, so it is
important to get it right.

Format: `type(scope): description`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
`ci`, `chore`, `revert`, `types`

Scopes (optional): `middleware`, `routes`, `utils`, `cache`, `r2`, `cors`,
`deps`

Examples:

- `feat(routes): add support for avif format transformation`
- `fix(middleware): resolve CORS origin validation edge case`
- `perf(cache): skip cache write for non-2xx responses`
- `chore(deps): update wrangler to v4`
- `docs: update contributing guidelines`

> **Note** Use lowercase letters in your pull request title. Individual commit
> messages within your PR don't need to follow this format since they'll be
> squashed.

### PR descriptions

If your pull request directly addresses an open issue, use the following inside
your PR description:

```text
Fixes #123
```

or

```text
Closes https://github.com/wolfstar-project/cdn/issues/123
```

This links the pull request to the issue and automatically closes it when the
PR is merged.

## Pre-commit hooks

Git hooks are managed via Husky. Staged files are linted and formatted
automatically by `nano-staged` on every commit. Commit messages are validated
against the Conventional Commits format by `commitlint`.

## Using AI

You're welcome to use AI tools to help you contribute. But there are two
important ground rules:

### 1. Never let an LLM speak for you

When you write a comment, issue, or PR description, use your own words. Grammar
and spelling don't matter -- real connection does. AI-generated summaries tend
to be long-winded, dense, and often inaccurate. The goal is not to sound
impressive, but to communicate clearly.

### 2. Never let an LLM think for you

Feel free to use AI to write code, tests, or point you in the right direction.
But always understand what it has written before contributing it. Take personal
responsibility for your contributions. Don't say "ChatGPT says..." -- tell us
what you think.

For more context, see
[Using AI in open source](https://roe.dev/blog/using-ai-in-open-source).

## Questions?

If you have questions or need help, feel free to
[open an issue](https://github.com/wolfstar-project/cdn/issues) for discussion.

## License

By contributing to wolfstar-cdn, you agree that your contributions will be
licensed under the [Apache License 2.0](LICENSE).
