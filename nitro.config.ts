import { fileURLToPath } from 'node:url';

import evlog from 'evlog/nitro/v3';
import { defineNitroConfig } from 'nitro/config';

const blobPackageDir = fileURLToPath(new URL('./node_modules/@vite-hub/blob/dist/', import.meta.url));

export default defineNitroConfig({
	preset: 'cloudflare_module',
	compatibilityDate: '2025-09-13',
	serverDir: './server',
	modules: [evlog({ env: { service: 'wolfstar-cdn' } })],
	alias: {
		'@vite-hub/blob/drivers/cloudflare': `${blobPackageDir}drivers/cloudflare.js`,
		'@vite-hub/blob/runtime/state': `${blobPackageDir}runtime/state.js`,
		'@vite-hub/blob/storage': `${blobPackageDir}storage.js`,
	},
	imports: {},
	errorHandler: './server/error',
});
