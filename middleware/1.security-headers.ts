import { defineEventHandler, setResponseHeaders } from 'nitro/h3';

/**
 * Applies a set of important security headers to all responses.
 * These headers help mitigate common web vulnerabilities like XSS and clickjacking.
 */
export default defineEventHandler((event) => {
	setResponseHeaders(event, {
		'X-Content-Type-Options': 'nosniff',
		'X-Frame-Options': 'DENY',
		'X-XSS-Protection': '1; mode=block',
	});
});
