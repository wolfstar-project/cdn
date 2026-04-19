import { useLogger } from 'evlog/nitro/v3';
import { defineErrorHandler } from 'nitro';

export default defineErrorHandler((error, event) => {
	try {
		const log = useLogger(event);
		log.error(error);
	} catch {
		console.error('Unhandled error:', error);
	}

	const errorResponse = {
		error: 'INTERNAL_ERROR',
		message: 'An unexpected error occurred',
		timestamp: new Date().toISOString(),
	};

	return new Response(JSON.stringify(errorResponse), {
		status: error.status || 500,
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'no-store',
		},
	});
});
