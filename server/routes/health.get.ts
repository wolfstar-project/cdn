import { defineHandler } from 'nitro';
import type { HealthResponse } from '../utils/types';

export default defineHandler((event) => {
	const data: HealthResponse = {
		status: 'ok',
		timestamp: new Date().toISOString(),
		worker: 'wolfstar-cdn',
		region: event.req.headers.get('cf-ray')?.split('-')[1],
	};

	event.res.headers.set('Cache-Control', 'no-store');
	event.res.headers.set('X-Robots-Tag', 'noindex');

	return data;
});
