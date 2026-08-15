import { fileURLToPath } from 'node:url';

// Type-only import: pulls in the `NitroConfig.blob` module augmentation from @vite-hub/blob/nitro
import type {} from '@vite-hub/blob/nitro';
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
	// The @vite-hub/blob Nitro module (registered by hubBlob() in vite.config.ts) reads
	// `nitro.options.blob` to build `runtimeConfig.blob`; the top-level `blob` key in
	// vite.config.ts only feeds the #vitehub/blob/config virtual module. Without this,
	// the runtime config falls back to the library default binding "BLOB".
	blob: {
		driver: 'cloudflare-r2',
		binding: 'wolfstar_cdn',
	},
});
