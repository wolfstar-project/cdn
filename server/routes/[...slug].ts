import { defineEventHandler, getRequestHeader, getRequestURL } from 'nitro/h3';
import { createErrorResponse, fetchFromR2, logger, parseTransformations } from '../utils/cdn';

/**
 * Main catch-all route for handling all incoming asset requests.
 * Determines if the request is for an image or a static file and handles it accordingly.
 * Supports GET and HEAD methods.
 */
export default defineEventHandler(async (event) => {
	// Only allow GET and HEAD methods
	if (event.method !== 'GET' && event.method !== 'HEAD') {
		return createErrorResponse(event, 'METHOD_NOT_ALLOWED', 'Only GET and HEAD methods are supported', 405);
	}

	try {
		const url = getRequestURL(event);
		const { pathname, searchParams } = url;
		const isHeadRequest = event.method === 'HEAD';
		const rangeHeader = getRequestHeader(event, 'range');

		// For images, parse transformation options from the URL query parameters
		const transformOptions = parseTransformations(pathname, searchParams);

		// Image transformations do not support Range requests.
		if (rangeHeader) {
			return createErrorResponse(event, 'RANGE_NOT_SUPPORTED', 'Range requests are not supported for image transformations', 400);
		}

		// Serve the file from R2
		const response = await fetchFromR2(pathname, transformOptions, event, isHeadRequest, rangeHeader);

		// Cache the response if it was successful
		if (response.ok && event.context._cache && event.context._cacheKey) {
			const clonedResponse = response.clone();
			clonedResponse.headers.set('X-Cache-Status', 'MISS');

			const cfContext = event.context.cloudflare?.context;
			if (cfContext?.waitUntil) {
				cfContext.waitUntil(
					event.context._cache.put(event.context._cacheKey, clonedResponse).catch((cacheError: unknown) => {
						logger.error({ action: 'cache_storage_error', error: cacheError instanceof Error ? cacheError.message : String(cacheError) });
					}),
				);
			} else {
				event.context._cache.put(event.context._cacheKey, clonedResponse).catch((cacheError: unknown) => {
					logger.error({ action: 'cache_storage_error', error: cacheError instanceof Error ? cacheError.message : String(cacheError) });
				});
			}
		}

		return response;
	} catch (error) {
		logger.error({ action: 'request_handler_error', error: error instanceof Error ? error.message : String(error) });
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		return createErrorResponse(event, 'REQUEST_ERROR', errorMessage, 500);
	}
});
