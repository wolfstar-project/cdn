import { defineHandler } from 'nitro';
import { handleCors } from 'nitro/h3';

export default defineHandler((event) => {
	// biome-ignore lint/style/noNonNullAssertion: We are confident that these properties will be available in the Cloudflare Workers environment
	const env = event.req.runtime!.cloudflare!.env;
	const allowedOrigins = env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map((o: string) => o.trim()) : [];

	return handleCors(event, {
		origin: (origin: string) => allowedOrigins.includes(origin),
		methods: ['GET', 'HEAD', 'OPTIONS'],
		allowHeaders: ['Content-Type', 'Range', 'If-Range', 'If-None-Match'],
		exposeHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
		maxAge: '86400',
		credentials: false,
	});
});
