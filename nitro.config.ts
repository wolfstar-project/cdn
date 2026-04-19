import { defineNitroConfig } from 'nitro/config';

export default defineNitroConfig({
	preset: 'cloudflare_module',
	compatibilityDate: '2025-09-13',
	serverDir: './server',
	cloudflare: {
		deployConfig: true,
		wrangler: {
			name: 'worker-r2-cdn',
			observability: { enabled: true },
			placement: { mode: 'smart' },
			vars: {
				ALLOWED_ORIGINS: 'https://wolfstar.rocks,https://beta.wolfstar.rocks',
				R2_WORKER_URL: 'worker-r2-cdn.redstar071.workers.dev',
			},
			// @ts-expect-error: ratelimits is a valid Wrangler config but not in Nitro types
			ratelimits: [
				{
					name: 'RATE_LIMITER',
					namespace_id: '1002',
					simple: {
						limit: 20,
						period: 60,
					},
				},
			],
		},
	},
	imports: {},
	errorHandler: './server/error',
});
