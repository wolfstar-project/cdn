import { defineEventHandler, getRequestHeader, setResponseHeaders } from 'nitro/h3';
import type { HealthResponse } from '../utils/types';

/**
 * Health check endpoint for monitoring the worker's status.
 * Returns a JSON response with status, timestamp, and region information.
 * This endpoint is excluded from caching.
 */
export default defineEventHandler((event) => {
	const data: HealthResponse = {
		status: 'ok',
		timestamp: new Date().toISOString(),
		worker: 'wolfstar-cdn',
		region: getRequestHeader(event, 'cf-ray')?.split('-')[1], // Extract region from CF-Ray header
	};

	setResponseHeaders(event, {
		'Cache-Control': 'no-store', // Ensure this response is never cached
		'X-Robots-Tag': 'noindex', // Prevent search engines from indexing this page
	});

	return data;
});
