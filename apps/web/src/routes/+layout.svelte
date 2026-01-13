<script lang="ts">
	import '../app.css';
	import Sidebar from '$lib/components/sidebar.svelte';
	import { Toaster } from 'svelte-sonner';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
	<title>لوحة التحكم - إدارة الواي فاي</title>
</svelte:head>

<div dir="rtl" lang="ar" class="app-wrapper">
	<div class="app-layout">
		<!-- Sidebar (on right for RTL) -->
		<Sidebar />

		<!-- Main Content -->
		<main class="main-content">
			<div class="content-container">
				{@render children()}
			</div>
		</main>
	</div>
</div>

<Toaster
	position="top-center"
	dir="rtl"
	richColors
	theme="dark"
	toastOptions={{
		style: 'font-family: Cairo, sans-serif;'
	}}
/>

<style>
	.app-wrapper {
		min-height: 100vh;
		position: relative;
	}

	.app-layout {
		display: flex;
		min-height: 100vh;
	}

	.main-content {
		flex: 1;
		overflow-x: hidden;
	}

	.content-container {
		padding: 32px;
		max-width: 1400px;
	}

	@media (max-width: 768px) {
		.content-container {
			padding: 20px;
		}
	}
</style>
