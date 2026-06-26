import { hubBlob } from '@vite-hub/blob/vite';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [nitro(), hubBlob()],
	blob: {
		driver: 'cloudflare-r2',
		binding: 'wolfstar_cdn',
	},
});
