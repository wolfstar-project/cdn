import { defineEventHandler, getRequestHeader, setResponseHeader } from 'nitro/h3';
import { logger } from '../utils/cdn';

/**
 * Implements a cache-aside strategy using the Cloudflare Cache API.
 * Caches successful responses to reduce R2 reads and improve performance.
 */
export default defineEventHandler(async (event) => {
	// Skip caching for the health check endpoint
	if (event.path === '/health') return;

	// Skip caching if Cache API is not available (e.g., local development)
	if (typeof caches === 'undefined') return;

	try {
		const cache = caches.default;
		const url = new URL(event.path, 'https://placeholder.dev');

		// Create a cache key that respects Range and Accept-Encoding headers
		// to prevent serving incorrect cached content.
		const cacheKeyHeaders = new Headers();
		const range = getRequestHeader(event, 'range');
		const encoding = getRequestHeader(event, 'accept-encoding');

		if (range) cacheKeyHeaders.set('range', range);
		if (encoding) cacheKeyHeaders.set('accept-encoding', encoding);

		const cacheKey = new Request(url.toString(), { headers: cacheKeyHeaders });
		const cachedResponse = await cache.match(cacheKey);

		// If a cached response is found, return it immediately
		if (cachedResponse) {
			const response = new Response(cachedResponse.body, cachedResponse);
			response.headers.set('X-Cache-Status', 'HIT');
			return response;
		}

		// Store cache key and cache reference in event context for post-handler caching
		event.context._cacheKey = cacheKey;
		event.context._cache = cache;
	} catch (error) {
		logger.error({ action: 'cache_middleware_error', error: error instanceof Error ? error.message : String(error) });
	}
});
