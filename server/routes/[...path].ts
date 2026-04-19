import { useLogger } from 'evlog/nitro/v3';
import { defineHandler } from 'nitro';
import { createErrorResponse } from '../utils/errors';
import { fetchFromR2, parseTransformations } from '../utils/r2';

export default defineHandler(async (event) => {
	const log = useLogger(event);
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
		const objectKey = pathname.startsWith('/') ? pathname.slice(1) : pathname;

		log.set({
			r2: { key: objectKey, transform: transformOptions !== null, range: !!rangeHeader },
		});

		if (transformOptions && rangeHeader) {
			return createErrorResponse('RANGE_NOT_SUPPORTED', 'Range requests are not supported for image transformations', 400);
		}

		const response = await fetchFromR2(pathname, transformOptions, env, isHeadRequest, rangeHeader);

		if (!response.ok) {
			log.set({ r2: { error: true, status: response.status } });
		}

		return response;
	} catch (error) {
		log.error(error as Error, { step: 'fetchFromR2' });
		return createErrorResponse('REQUEST_ERROR', 'An unexpected error occurred', 500);
	}
});
