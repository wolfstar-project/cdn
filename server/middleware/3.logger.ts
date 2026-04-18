import { defineEventHandler, getRequestHeader } from 'nitro/h3';
import { logger } from '../utils/cdn';

/**
 * Request logger using evlog.
 * Outputs structured information about each incoming request.
 */
export default defineEventHandler((event) => {
	const start = Date.now();

	event.context._startTime = start;

	logger.info({
		action: 'request_start',
		method: event.method,
		path: event.path,
		ip: getRequestHeader(event, 'cf-connecting-ip') || getRequestHeader(event, 'x-forwarded-for'),
	});
});
