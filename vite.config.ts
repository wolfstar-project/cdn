import { hubBlob } from '@vite-hub/blob/vite';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [hubBlob(), nitro()],
	// hubBlob() reads the preset from here to know Nitro owns the Cloudflare output;
	// otherwise it also emits a Vercel output and requires the optional S3 peer dependencies.
	nitro: { preset: 'cloudflare_module' },
	blob: {
		driver: 'cloudflare-r2',
		binding: 'wolfstar_cdn',
		// bucketName selects the native R2 binding driver instead of the S3 HTTP fallback
		bucketName: 'wolfstar-cdn',
	},
});
