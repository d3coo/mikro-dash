import adapterNode from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Use Cloudflare adapter when ADAPTER=cloudflare is set
const useCloudflare = process.env.ADAPTER === 'cloudflare';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	// Suppress a11y warnings for modal overlay patterns (divs with click handlers)
	compilerOptions: {
		warningFilter: (warning) => {
			if (warning.code === 'a11y_click_events_have_key_events') return false;
			if (warning.code === 'a11y_no_static_element_interactions') return false;
			return true;
		}
	},

	kit: {
		adapter: useCloudflare
			? (await import('@sveltejs/adapter-cloudflare')).default({
				routes: {
					include: ['/*'],
					exclude: ['<all>']
				}
			})
			: adapterNode({
				out: 'build'
			}),
		// Allow form submissions from local network
		csrf: {
			checkOrigin: false
		}
	}
};

export default config;
