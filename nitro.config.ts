import { defineConfig } from 'nitro';

export default defineConfig({
	preset: 'cloudflare_module',
	compatibilityDate: '2025-09-13',
	serverDir: true,
	imports: {},
	errorHandler: './server/error.ts',
});
