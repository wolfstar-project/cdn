import { defineHandler } from 'nitro';

import { getCloudflareEnv } from '../utils/cloudflare';

export default defineHandler(async (event) => {
	const env = getCloudflareEnv(event);

	const ip =
		event.req.headers.get('cf-connecting-ip') || event.req.headers.get('x-forwarded-for') || event.req.headers.get('x-real-ip') || '';

	const { success } = await env.RATE_LIMITER.limit({ key: ip });

	if (!success) {
		return new Response(
			JSON.stringify({
				error: 'RATE_LIMITED',
				message: 'Too many requests',
				timestamp: new Date().toISOString(),
			}),
			{
				status: 429,
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'no-store',
				},
			},
		);
	}

	return undefined;
});
