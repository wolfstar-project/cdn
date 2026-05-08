import { defineHandler } from 'nitro';

export default defineHandler(async (event) => {
	// oxlint-disable-next-line typescript/no-non-null-assertion -- We are confident that these properties will be available in the Cloudflare Workers environment
	const env = event.req.runtime!.cloudflare!.env;

	const ip =
		event.req.headers.get('cf-connecting-ip') || event.req.headers.get('x-forwarded-for') || event.req.headers.get('x-real-ip') || '';

	// @ts-expect-error -- The RATE_LIMITER binding is expected to be present in the Cloudflare Workers environment, but may not be recognized by TypeScript
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
