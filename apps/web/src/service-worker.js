/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const CACHE_NAME = `cache-${version}`;

// App shell: JS/CSS bundles built by Vite
const APP_SHELL = build;

// Static files: fonts, icons, images
const STATIC_FILES = files;

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => cache.addAll([...APP_SHELL, ...STATIC_FILES]))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	// Skip cross-origin requests (Convex, external APIs)
	if (url.origin !== self.location.origin) return;

	// Cache-first for app shell and static files
	const isAppShell = APP_SHELL.includes(url.pathname);
	const isStaticFile = STATIC_FILES.includes(url.pathname);

	if (isAppShell || isStaticFile) {
		event.respondWith(
			caches.match(event.request).then((cached) => cached || fetch(event.request))
		);
		return;
	}

	// Network-first for everything else (SSR pages, API calls)
	event.respondWith(
		fetch(event.request)
			.then((response) => {
				// Only cache successful GET responses for navigation
				if (response.ok && event.request.mode === 'navigate') {
					const clone = response.clone();
					caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
				}
				return response;
			})
			.catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
	);
});
