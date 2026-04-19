import { definePlugin } from 'nitro';

export default definePlugin((nitroApp) => {
	nitroApp.hooks.hook('request', (event) => {
		const url = new URL(event.req.url);
		console.log(`  --> ${event.req.method} ${url.pathname}`);
	});
});
