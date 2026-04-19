import { definePlugin } from 'nitro';

export default definePlugin((nitroApp) => {
	nitroApp.hooks.hook('response', (res) => {
		res.headers.set('X-Content-Type-Options', 'nosniff');
		res.headers.set('X-Frame-Options', 'DENY');
		res.headers.set('X-XSS-Protection', '1; mode=block');
	});
});
