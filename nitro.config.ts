import blobNitroModule from '@vite-hub/blob/nitro';
import evlog from 'evlog/nitro/v3';
import { defineNitroConfig } from 'nitro/config';

export default defineNitroConfig({
	preset: 'cloudflare_module',
	compatibilityDate: '2025-09-13',
	serverDir: './server',
	modules: [evlog({ env: { service: 'wolfstar-cdn' } }), blobNitroModule],
	blob: {
		driver: 'cloudflare-r2',
		binding: 'wolfstar_cdn',
	},
	imports: {},
	errorHandler: './server/error',
});
