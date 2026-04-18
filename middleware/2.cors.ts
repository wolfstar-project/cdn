import { defineEventHandler, getRequestHeader, setResponseHeaders, setResponseStatus } from 'nitro/h3';
import { getAllowedOrigin } from '../utils/cdn';

/**
 * Configures Cross-Origin Resource Sharing (CORS) for the CDN.
 * It dynamically allows origins based on environment variables for improved security.
 * Handles OPTIONS preflight requests.
 */
export default defineEventHandler((event) => {
	const origin = getRequestHeader(event, 'origin');

	if (origin) {
		const allowedOrigin = getAllowedOrigin(origin, event);
		if (allowedOrigin) {
			setResponseHeaders(event, {
				'Access-Control-Allow-Origin': allowedOrigin,
				'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type, Range, If-Range, If-None-Match',
				'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length',
				'Access-Control-Max-Age': '86400', // Cache preflight response for 24 hours
			});
		}
	}

	// Handle OPTIONS preflight requests
	if (event.method === 'OPTIONS') {
		setResponseStatus(event, 204);
		return '';
	}
});
