<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Sidebar from '$lib/components/sidebar.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap" rel="stylesheet" />
	<title>لوحة التحكم - إدارة الواي فاي</title>
</svelte:head>

<div dir="rtl" lang="ar" class="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
	<div class="flex">
		<!-- Main Content (comes first in RTL) -->
		<main class="flex-1 p-8">
			{@render children()}
		</main>

		<!-- Sidebar (appears on right in RTL) -->
		<Sidebar />
	</div>
</div>
