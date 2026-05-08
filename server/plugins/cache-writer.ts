import { definePlugin } from 'nitro';

export default definePlugin((nitroApp) => {
	nitroApp.hooks.hook('response', (res, event) => {
		// oxlint-disable-next-line no-underscore-dangle
		const cacheKey = event.req.context!._cacheKey as Request | undefined;
		if (!cacheKey) return;

		const method = event.req.method;
		if (method !== 'GET') return;

		if (res.status < 200 || res.status >= 300) return;

		res.headers.set('X-Cache-Status', 'MISS');

		try {
			// @ts-expect-error: caches.default is a Cloudflare Workers global
			const cache: Cache = caches.default;
			const responseToCache = new Response(res.body, {
				status: res.status,
				headers: res.headers,
			});

			event.req.waitUntil?.(
				cache.put(cacheKey, responseToCache).catch((cacheError: unknown) => {
					console.error('Cache storage error:', cacheError);
				}),
			);
		} catch (cacheWriterError: unknown) {
			console.error('Cache writer error:', cacheWriterError);
		}
	});
});
