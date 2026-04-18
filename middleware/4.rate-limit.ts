import { defineEventHandler, getRequestHeader, setResponseStatus } from 'nitro/h3';
import { getCloudflareEnv, logger } from '../utils/cdn';

/**
 * Implements rate limiting to protect the service from abuse.
 * Uses the client's IP address and the Cloudflare Rate Limiter binding.
 */
export default defineEventHandler(async (event) => {
	const env = getCloudflareEnv(event);

	// Skip rate limiting if binding is not available (e.g., local development)
	if (!env.RATE_LIMITER) return;

	const clientIp =
		getRequestHeader(event, 'cf-connecting-ip') ||
		getRequestHeader(event, 'x-forwarded-for') ||
		getRequestHeader(event, 'x-real-ip') ||
		'unknown';

	try {
		const { success } = await env.RATE_LIMITER.limit({ key: clientIp });

		if (!success) {
			logger.warn({ action: 'rate_limited', ip: clientIp, path: event.path });
			setResponseStatus(event, 429);
			return {
				error: 'RATE_LIMITED',
				message: 'Too many requests, please try again later',
				timestamp: new Date().toISOString(),
			};
		}
	} catch (error) {
		logger.error({ action: 'rate_limit_error', error: error instanceof Error ? error.message : String(error) });
	}
});
