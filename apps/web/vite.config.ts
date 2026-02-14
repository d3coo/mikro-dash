import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		host: '0.0.0.0', // Bind to all interfaces so router can send webhooks
		fs: {
			// Allow serving files from the convex directory
			allow: ['..', 'convex']
		}
	}
});
