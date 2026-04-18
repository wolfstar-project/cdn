import { defineErrorHandler } from 'nitro';
import { logger } from '../utils/cdn';
import type { ErrorResponse } from '../utils/types';

/**
 * Global error handler for the application.
 * Catches unhandled errors and returns a standardized JSON error response.
 */
export default defineErrorHandler((error, event) => {
	logger.error({
		action: 'unhandled_error',
		error: error.message,
		statusCode: error.statusCode,
		path: event.path,
	});

	const statusCode = error.statusCode || 500;
	const errorResponse: ErrorResponse = {
		error: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
		message: statusCode === 404 ? 'The requested resource was not found' : 'An unexpected error occurred',
		timestamp: new Date().toISOString(),
	};

	return new Response(JSON.stringify(errorResponse), {
		status: statusCode,
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'no-store',
		},
	});
});
