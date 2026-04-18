import type { NitroConfig } from 'nitro/types';

export default {
	preset: 'cloudflare_module',
	compatibilityDate: '2025-09-13',
	serverDir: './server',
	errorHandler: './server/error.ts',
} satisfies NitroConfig;
