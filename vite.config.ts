import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		nitro({
			preset: 'cloudflare_module',
			compatibilityDate: '2025-09-13',
			serverDir: './server',
			errorHandler: './server/error.ts',
		}),
	],
});
