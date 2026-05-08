import { defineHandler } from 'nitro';
import { handleCors } from 'nitro/h3';

export default defineHandler((event) => {
	// biome-ignore lint/style/noNonNullAssertion: We are confident that these properties will be available in the Cloudflare Workers environment
	const env = event.req.runtime!.cloudflare!.env;
	const allowedOrigins = env.ALLOWED_ORIGINS ? (env.ALLOWED_ORIGINS as string).split(',').map((o: string) => o.trim()) : [];

	// h3 v2: handleCors returns a Response (noContent) for preflight, or `false` for all other
	// methods after appending CORS headers as a side effect. Returning `false` from a Nitro
	// middleware short-circuits with that literal value as the response body. Only short-circuit
	// when h3 actually handled the request (preflight); otherwise continue the chain.
	const handled = handleCors(event, {
		origin: (origin: string) => allowedOrigins.includes(origin),
		methods: ['GET', 'HEAD', 'OPTIONS'],
		allowHeaders: ['Content-Type', 'Range', 'If-Range', 'If-None-Match'],
		exposeHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
		maxAge: '86400',
		credentials: false,
	});

	if (handled !== false) return handled;
	return undefined;
});
