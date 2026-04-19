import { defineHandler } from 'nitro';
import { createErrorResponse } from '../utils/errors';
import { fetchFromR2, parseTransformations } from '../utils/r2';

export default defineHandler(async (event) => {
	const method = event.req.method;

	if (method !== 'GET' && method !== 'HEAD') {
		return createErrorResponse('METHOD_NOT_ALLOWED', 'Only GET and HEAD methods are supported', 405);
	}

	try {
		// biome-ignore lint/style/noNonNullAssertion: We are confident that these properties will be available in the Cloudflare Workers environment
		const env = event.req.runtime!.cloudflare!.env;
		const { pathname, searchParams } = new URL(event.req.url);
		const isHeadRequest = method === 'HEAD';
		const rangeHeader = event.req.headers.get('range') ?? undefined;

		const transformOptions = parseTransformations(pathname, searchParams);

		if (transformOptions && rangeHeader) {
			return createErrorResponse('RANGE_NOT_SUPPORTED', 'Range requests are not supported for image transformations', 400);
		}

		return await fetchFromR2(pathname, transformOptions, env, isHeadRequest, rangeHeader);
	} catch (error) {
		console.error('Request handler error:', error);
		return createErrorResponse('REQUEST_ERROR', 'An unexpected error occurred', 500);
	}
});
