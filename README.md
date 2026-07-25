<div align="center"><a name="readme-top"></a>

<img src="https://github.com/WolfStarBot.png" width="15%" alt="WolfStar Logo">

# WolfStar CDN

Cloudflare Worker CDN for image delivery and on-the-fly transformation.<br/>
Serves assets from R2 with Cloudflare Image Transformations, cache-aside
caching, CORS, rate limiting, and security headers.

[Official Site][official-site] · [Blog][blog] · [WolfStar Invite
Link][invite-link] · [Support Server][discord-link] ·
[Feedback][github-issues-link]

<!-- SHIELD GROUP -->

[![GitHub latest release badge][github-release-shield]][github-release-link]
[![GitHub last commit badge][github-last-commit-shield]][github-last-commit-link]<br/>
[![Discord community badge][discord-shield]][discord-link]
[![GitHub contributors badge][github-contributors-shield]][github-contributors-link]<br/>
[![GitHub forks badge][github-forks-shield]][github-forks-link]
[![GitHub stars badge][github-stars-shield]][github-stars-link]
[![GitHub issues badge][github-issues-shield]][github-issues-link]
[![GitHub license badge][github-license-shield]][github-license-link]<br>
[![PRs welcome badge][pr-welcome-shield]][pr-welcome-link]

### Share WolfStar Repository

[![][share-linkedin-shield]][share-linkedin-link]
[![][share-reddit-shield]][share-reddit-link]
[![][share-telegram-shield]][share-telegram-link]
[![][share-whatsapp-shield]][share-whatsapp-link]
[![][share-x-shield]][share-x-link] <sup>Fast, secure asset delivery for the
WolfStar Network.</sup>

</div>

<details>
<summary><kbd>Table of contents</kbd></summary>

## Table of Contents

- [✨ Features](#-features)
- [🚀 Requirements](#-requirements)
- [🛳 Getting Started](#-getting-started)
- [📦 Usage](#-usage)
- [⌨️ Local Development](#️-local-development)
- [💻 Online Development](#-online-development)
- [🤝 Contributing](#-contributing)
- [❤️ Sponsor](#️-sponsor)

<br/>

</details>

<div id="-welcome-to-wolfstar-cdn">

## 👋🏻 Welcome to WolfStar CDN

WolfStar CDN is a Cloudflare Worker that serves and transforms images from R2
storage for the WolfStar Network. Built with Nitro v3 and TypeScript, it
prioritizes **stability**, **speed**, and **security**.

</div>

<div id="-features">

## ✨ Features

- **R2 Asset Delivery**: Serve objects directly from Cloudflare R2 with
  immutable long-lived cache headers.
- **On-the-fly Image Transformations**: Resize, reformat, and adjust quality via
  query parameters using Cloudflare Image Transformations.
- **Cache-aside Caching**: HIT/MISS path via the Cloudflare Cache API with
  `X-Cache-Status` headers.
- **CORS**: Dynamic origin validation from an allowlist of trusted origins.
- **Rate Limiting**: 20 requests per 60 seconds per IP via Cloudflare Rate Limit
  binding.
- **Security Headers**: `X-Content-Type-Options`, `X-Frame-Options`, and
  `X-XSS-Protection` on every response.
- **Range Requests**: Partial content (`bytes=`) support for large assets
  (mutually exclusive with image transforms).
- **Health Check**: Lightweight `/health` endpoint for uptime monitoring.
- **Structured Logging**: Wide-event request logs via `evlog`.

</div>

<div id="-requirements">

## 🚀 Requirements

- **Node.js**: 22+ (LTS)
- **pnpm**: 10+ (required — not npm or yarn)
- **Wrangler**: 4+ (Cloudflare CLI)
- **Cloudflare account**: With R2 storage enabled and Image Transformations
  available for transform routes

</div>

<div id="-getting-started">

## 🛳 Getting Started

### Quick Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/wolfstar-project/cdn.git
   cd cdn
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Configure Cloudflare bindings**

   Open `wrangler.jsonc` and update the required values:

   | Binding           | Kind      | Description                             |
   | ----------------- | --------- | --------------------------------------- |
   | `wolfstar_cdn`    | R2Bucket  | Primary asset storage                   |
   | `RATE_LIMITER`    | RateLimit | 20 requests per 60 s per IP             |
   | `ALLOWED_ORIGINS` | env var   | Comma-separated list of allowed origins |
   | `R2_WORKER_URL`   | env var   | Base URL used when constructing fetches |

   > **Note** Secrets must be added via `wrangler secret put <NAME>` and must
   > **never** be committed to the repository.

4. **Start the development server**

   ```bash
   pnpm dev
   ```

   > **Note** The Cloudflare Cache API (`caches.default`) and rate limiting
   > bindings are only available inside the Cloudflare Workers runtime. Some
   > features will be skipped or no-op locally.

### Available Scripts

- `pnpm dev` — Start Nitro dev server (local Workers emulation)
- `pnpm build` — Production build via Vite + Nitro
- `pnpm deploy` — Deploy prebuilt output via Wrangler
- `pnpm preview` — Preview the production build locally
- `pnpm lint` — Run Oxlint + Oxfmt check (no auto-fix)
- `pnpm lint:fix` — Run Oxlint & Oxfmt and fix issues
- `pnpm typecheck` — Type-check with `tsc --noEmit` (must pass with zero errors)

### Project Structure

```text
nitro.config.ts          -- Nitro config (preset, cloudflare bindings)
vite.config.ts           -- Vite config (nitro plugin)
wrangler.jsonc           -- Wrangler deployment and bindings configuration
server/
  error.ts               -- Global error handler
  middleware/
    01.cors.ts           -- CORS middleware (dynamic origin validation)
    02.rate-limiter.ts   -- Rate limiting (20 req/60s)
    03.cache.ts          -- Cache-read middleware (HIT path)
  plugins/
    security-headers.ts  -- Security headers
    cache-writer.ts      -- Cache-write plugin (MISS path)
  routes/
    health.get.ts        -- Health check endpoint
    [...path].ts         -- Catch-all CDN route
  utils/
    types.ts             -- Type definitions
    constants.ts         -- Image extensions, dimension limits, cache TTL
    errors.ts            -- Error response factory
    blob.ts              -- Blob/R2 utilities (fetch, transform, range, parse)
```

### Development Tools

- **Nitro v3** — Cloudflare Workers server runtime
- **TypeScript** — Type safety
- **Vite** — Build tooling
- **Wrangler** — Cloudflare Workers CLI
- **Oxlint** — Code linting
- **Oxfmt** — Code formatting
- **evlog** — Structured wide-event logging
- **@vite-hub/blob** — R2 blob storage abstraction

</div>

<div id="-usage">

## 📦 Usage

### Fetch an asset

```http
GET /path/to/image.png
```

### Transform an image

Transformations apply when the file extension is an image
(`jpg`, `jpeg`, `png`, `gif`, `webp`, `svg`, `tiff`, `avif`) **and** at least one
transform parameter is present.

| Param | Description            | Valid values                                    |
| ----- | ---------------------- | ----------------------------------------------- |
| `w`   | Width                  | `1`–`4096`                                      |
| `h`   | Height                 | `1`–`4096`                                      |
| `q`   | Quality (default `85`) | `1`–`100`                                       |
| `fit` | Resize fit mode        | `scale-down`, `contain`, `cover`, `crop`, `pad` |
| `f`   | Output format          | `webp`, `avif`, `jpeg`, `png`                   |

```http
GET /avatars/user.png?w=256&h=256&fit=cover&f=webp&q=80
```

> Range requests and image transformations are mutually exclusive. Combining
> both returns `400`.

### Health check

```http
GET /health
```

Returns JSON with worker status, timestamp, and Cloudflare region.

</div>

<div id="️-local-development">

## ⌨️ Local Development

Refer to [CONTRIBUTING.md][contributing-link] for detailed setup instructions,
code style, and the pull request process.

Before committing:

1. `pnpm build` — must build successfully
2. `pnpm lint:fix` — fix lint and format issues
3. `pnpm typecheck` — must pass with zero type errors
4. Commit messages must follow
   [Conventional Commits](https://www.conventionalcommits.org/)

</div>

<div id="-online-development">

## 💻 Online Development

Click any of the buttons below to start a new development environment to demo or
contribute to the codebase without having to install anything on your machine:

<div align="center">

[![Open in VS Code](https://img.shields.io/badge/Open%20in-VS%20Code-blue?logo=visualstudiocode)](https://vscode.dev/github/wolfstar-project/cdn)
[![Open in GitHub1s](https://img.shields.io/badge/Open%20in-GitHub1s-blue?logo=github)](https://github1s.com/wolfstar-project/cdn)
[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/wolfstar-project/cdn)
[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/wolfstar-project/cdn)
[![Edit in Codesandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/wolfstar-project/cdn)
[![Open in Codeanywhere](https://codeanywhere.com/img/open-in-codeanywhere-btn.svg)](https://app.codeanywhere.com/#https://github.com/wolfstar-project/cdn)

</div>

</div>

<br/>

<div id="-contributing">

## 🤝 Contributing

Thank you to all the people who already contributed to WolfStar CDN! Please make
sure to read the [Contributing Guide][contributing-link] before making a pull
request.

<a href="https://github.com/wolfstar-project/cdn/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=wolfstar-project/cdn" alt="Contributors" />
</a>

</div>

<br/>

<div id="️-sponsor">

## ❤️ Sponsor

If you like WolfStar and want to support the project, consider making a
donation. Every contribution helps to maintain and improve the network.

[![Support on Ko-fi](https://img.shields.io/badge/Support%20on%20Ko--fi-ff5e5b?style=for-the-badge&logo=ko-fi&logoColor=white)][ko-fi-link]
[![Support on Patreon](https://img.shields.io/badge/Support%20on%20Patreon-F96854?style=for-the-badge&logo=patreon&logoColor=white)][patreon-link]
[![Sponsor on GitHub](https://img.shields.io/badge/Sponsor%20on%20GitHub-ffcb47?style=for-the-badge&logo=github&logoColor=white)][github-sponsor-link]

Thank you for your support!

</div>

<br/>

---

<div align="center">

[![Back to top][back-to-top]](#readme-top)

</div>

---

<details>
<summary><kbd>📝 License</kbd></summary>

<br/>

Copyright © 2024 [WolfStar][profile-link]. This project is
[Apache 2.0](./LICENSE) licensed.

</details>

<!-- LINK DEFINITIONS -->

[ko-fi-link]: https://ko-fi.com/redstar071
[patreon-link]: https://www.patreon.com/RedStar071
[github-sponsor-link]: https://github.com/sponsors/wolfstar-project
[back-to-top]: https://img.shields.io/badge/-BACK_TO_TOP-151515?style=flat-square
[blog]: https://blog.wolfstar.rocks
[contributing-link]: https://github.com/wolfstar-project/cdn/blob/main/.github/CONTRIBUTING.md
[discord-link]: https://join.wolfstar.rocks
[discord-shield]: https://shieldcn.dev/discord/830481105261821952?variant=branded
[github-contributors-link]: https://github.com/wolfstar-project/cdn/graphs/contributors
[github-contributors-shield]: https://shieldcn.dev/github/contributors/wolfstar-project/cdn?variant=branded
[github-forks-link]: https://github.com/wolfstar-project/cdn/network/members
[github-forks-shield]: https://shieldcn.dev/github/forks/wolfstar-project/cdn?variant=branded
[github-issues-link]: https://github.com/wolfstar-project/cdn/issues
[github-issues-shield]: https://shieldcn.dev/github/issues/wolfstar-project/cdn?variant=branded
[github-license-link]: https://github.com/wolfstar-project/cdn/blob/main/LICENSE
[github-license-shield]: https://shieldcn.dev/github/license/wolfstar-project/cdn?variant=branded
[github-release-link]: https://github.com/wolfstar-project/cdn/releases
[github-release-shield]: https://shieldcn.dev/github/release/wolfstar-project/cdn?variant=branded
[github-last-commit-link]: https://github.com/wolfstar-project/cdn/commits
[github-last-commit-shield]: https://shieldcn.dev/github/last-commit/wolfstar-project/cdn?variant=branded
[github-stars-link]: https://github.com/wolfstar-project/cdn/network/stargazers
[github-stars-shield]: https://shieldcn.dev/github/stars/wolfstar-project/cdn?variant=branded
[official-site]: https://wolfstar.rocks
[pr-welcome-link]: https://github.com/wolfstar-project/cdn/pulls
[pr-welcome-shield]: https://shieldcn.dev/badge/PRs-welcome-ffcb47?variant=branded
[profile-link]: https://github.com/wolfstar-project
[share-linkedin-shield]: https://img.shields.io/badge/-share%20on%20linkedin-black?labelColor=black&logo=linkedin&logoColor=white&style=flat-square
[share-linkedin-link]: https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fgithub.com%2Fwolfstar-project%2Fcdn
[share-reddit-shield]: https://img.shields.io/badge/-share%20on%20reddit-black?labelColor=black&logo=reddit&logoColor=white&style=flat-square
[share-reddit-link]: https://www.reddit.com/submit?title=Check%20this%20GitHub%20repository%20out%20%F0%9F%A4%AF%20WolfStar%20CDN%20-%20Fast%20secure%20asset%20delivery%20for%20the%20WolfStar%20Network.&url=https%3A%2F%2Fgithub.com%2Fwolfstar-project%2Fcdn
[share-telegram-shield]: https://img.shields.io/badge/-share%20on%20telegram-black?labelColor=black&logo=telegram&logoColor=white&style=flat-square
[share-telegram-link]: https://t.me/share/url?text=Check%20this%20GitHub%20repository%20out%20%F0%9F%A4%AF%20WolfStar%20CDN%20-%20Fast%20secure%20asset%20delivery%20for%20the%20WolfStar%20Network.&url=https%3A%2F%2Fgithub.com%2Fwolfstar-project%2Fcdn
[share-whatsapp-shield]: https://img.shields.io/badge/-share%20on%20whatsapp-black?labelColor=black&logo=whatsapp&logoColor=white&style=flat-square
[share-whatsapp-link]: https://api.whatsapp.com/send?text=Check%20this%20GitHub%20repository%20out%20%F0%9F%A4%AF%20WolfStar%20CDN%20-%20Fast%20secure%20asset%20delivery%20for%20the%20WolfStar%20Network.%20https%3A%2F%2Fgithub.com%2Fwolfstar-project%2Fcdn
[share-x-shield]: https://img.shields.io/badge/-share%20on%20x-black?labelColor=black&logo=x&logoColor=white&style=flat-square
[share-x-link]: https://x.com/intent/tweet?hashtags=cloudflare%2Cworkers%2Ccdn&text=Check%20this%20GitHub%20repository%20out%20%F0%9F%A4%AF%20WolfStar%20CDN%20-%20Fast%20secure%20asset%20delivery%20for%20the%20WolfStar%20Network.&url=https%3A%2F%2Fgithub.com%2Fwolfstar-project%2Fcdn
[invite-link]: https://invite.wolfstar.rocks
