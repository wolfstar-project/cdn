import { defineErrorHandler } from 'nitro';

export default defineErrorHandler((error, _event) => {
	const errorResponse = {
		error: 'INTERNAL_ERROR',
		message: 'An unexpected error occurred',
		timestamp: new Date().toISOString(),
	};

	return new Response(JSON.stringify(errorResponse), {
		status: error.statusCode || 500,
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'no-store',
		},
	});
});
