import { defineHandler } from 'nitro';

export default defineHandler(async (event) => {
	if (event.req.method !== 'GET' && event.req.method !== 'HEAD') return;

	const url = new URL(event.req.url);
	if (url.pathname === '/health') return;

	try {
		// @ts-expect-error: caches.default is a Cloudflare Workers global
		const cache: Cache = caches.default;

		const cacheKeyHeaders = new Headers();
		const range = event.req.headers.get('range');
		const encoding = event.req.headers.get('accept-encoding');

		if (range) cacheKeyHeaders.set('range', range);
		if (encoding) cacheKeyHeaders.set('accept-encoding', encoding);

		const cacheKey = new Request(url.toString(), { method: event.req.method, headers: cacheKeyHeaders });
		const cachedResponse = await cache.match(cacheKey);

		if (cachedResponse) {
			const response = new Response(cachedResponse.body, cachedResponse);
			response.headers.set('X-Cache-Status', 'HIT');
			return response;
		}

		event.context._cacheKey = cacheKey;
	} catch (error) {
		console.error('Cache middleware error:', error);
	}

	return undefined;
});
