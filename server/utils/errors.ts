import type { ErrorResponse } from './types';

export function createErrorResponse(error: string, message: string, status = 500): Response {
	const errorResponse: ErrorResponse = {
		error,
		message,
		timestamp: new Date().toISOString(),
	};

	return new Response(JSON.stringify(errorResponse), {
		status,
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'no-store',
		},
	});
}
