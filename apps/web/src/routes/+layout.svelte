<script lang="ts">
	import '../app.css';
	import Sidebar from '$lib/components/sidebar.svelte';
	import { Toaster } from 'svelte-sonner';
	import { navigating } from '$app/stores';
	import { browser } from '$app/environment';
	import { setupConvex } from 'convex-svelte';
	import { PUBLIC_CONVEX_URL } from '$env/static/public';

	let { children } = $props();

	// Initialize Convex client for Svelte context
	if (browser && PUBLIC_CONVEX_URL) {
		setupConvex(PUBLIC_CONVEX_URL);
	}

	// Determine skeleton type based on target page
	let targetPath = $derived($navigating?.to?.url?.pathname || '');
	let skeletonType = $derived.by(() => {
		if (!targetPath) return null;
		if (targetPath === '/playstation') return 'grid-cards';
		if (targetPath === '/fnb') return 'grid-cards';
		if (targetPath === '/vouchers') return 'table';
		if (targetPath === '/users') return 'table';
		if (targetPath === '/sessions') return 'table';
		if (targetPath === '/wifi') return 'network-cards';
		if (targetPath === '/settings') return 'form';
		if (targetPath === '/analytics') return 'charts';
		if (targetPath === '/' || targetPath === '') return 'dashboard';
		if (targetPath.startsWith('/playstation/')) return 'table';
		return 'generic';
	});
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
	<title>لوحة التحكم - إدارة الواي فاي</title>
</svelte:head>

<div dir="rtl" lang="ar" class="app-wrapper">
	<!-- Navigation Loading Skeleton -->
	{#if $navigating && skeletonType}
		<div class="nav-loading-skeleton">
			<!-- Header with title and stats -->
			<div class="skeleton-header">
				<div class="skeleton-title"></div>
				{#if skeletonType !== 'form'}
					<div class="skeleton-stats">
						<div class="skeleton-stat"></div>
						<div class="skeleton-stat"></div>
						<div class="skeleton-stat"></div>
						{#if skeletonType === 'dashboard'}
							<div class="skeleton-stat"></div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Grid Cards (PlayStation, FnB) -->
			{#if skeletonType === 'grid-cards'}
				<div class="skeleton-grid">
					{#each Array(8) as _, i}
						<div class="skeleton-card" style="animation-delay: {i * 50}ms">
							<div class="skeleton-card-header">
								<div class="skeleton-line w-24"></div>
								<div class="skeleton-badge"></div>
							</div>
							<div class="skeleton-card-body">
								<div class="skeleton-circle"></div>
								<div class="skeleton-line w-16"></div>
							</div>
							<div class="skeleton-card-footer">
								<div class="skeleton-button"></div>
								<div class="skeleton-button"></div>
							</div>
						</div>
					{/each}
				</div>

			<!-- Table (Vouchers, Users, Sessions) -->
			{:else if skeletonType === 'table'}
				<div class="skeleton-table-wrapper">
					<div class="skeleton-toolbar">
						<div class="skeleton-search"></div>
						<div class="skeleton-filters">
							<div class="skeleton-filter"></div>
							<div class="skeleton-filter"></div>
						</div>
					</div>
					<div class="skeleton-table">
						<div class="skeleton-table-header">
							{#each Array(5) as _}
								<div class="skeleton-th"></div>
							{/each}
						</div>
						{#each Array(8) as _, i}
							<div class="skeleton-table-row" style="animation-delay: {i * 30}ms">
								{#each Array(5) as _, j}
									<div class="skeleton-td" style="width: {j === 0 ? '15%' : j === 4 ? '20%' : '18%'}"></div>
								{/each}
							</div>
						{/each}
					</div>
				</div>

			<!-- Network Cards (WiFi) -->
			{:else if skeletonType === 'network-cards'}
				<div class="skeleton-network-grid">
					{#each Array(4) as _, i}
						<div class="skeleton-network-card" style="animation-delay: {i * 50}ms">
							<div class="skeleton-network-icon"></div>
							<div class="skeleton-network-info">
								<div class="skeleton-line w-32"></div>
								<div class="skeleton-line w-24"></div>
							</div>
							<div class="skeleton-network-status"></div>
						</div>
					{/each}
				</div>

			<!-- Form (Settings) -->
			{:else if skeletonType === 'form'}
				<div class="skeleton-form">
					{#each Array(4) as _, i}
						<div class="skeleton-form-group" style="animation-delay: {i * 50}ms">
							<div class="skeleton-label"></div>
							<div class="skeleton-input"></div>
						</div>
					{/each}
					<div class="skeleton-form-actions">
						<div class="skeleton-button-lg"></div>
					</div>
				</div>

			<!-- Charts (Analytics) -->
			{:else if skeletonType === 'charts'}
				<div class="skeleton-charts">
					<div class="skeleton-chart-row">
						<div class="skeleton-chart-card large">
							<div class="skeleton-chart-title"></div>
							<div class="skeleton-chart-area"></div>
						</div>
					</div>
					<div class="skeleton-chart-row">
						{#each Array(3) as _, i}
							<div class="skeleton-chart-card" style="animation-delay: {i * 50}ms">
								<div class="skeleton-chart-title"></div>
								<div class="skeleton-chart-value"></div>
							</div>
						{/each}
					</div>
				</div>

			<!-- Dashboard -->
			{:else if skeletonType === 'dashboard'}
				<div class="skeleton-dashboard">
					<div class="skeleton-dash-stats">
						{#each Array(4) as _, i}
							<div class="skeleton-dash-stat" style="animation-delay: {i * 50}ms">
								<div class="skeleton-dash-icon"></div>
								<div class="skeleton-dash-info">
									<div class="skeleton-line w-16"></div>
									<div class="skeleton-line w-24"></div>
								</div>
							</div>
						{/each}
					</div>
					<div class="skeleton-dash-grid">
						<div class="skeleton-dash-card large"></div>
						<div class="skeleton-dash-card"></div>
						<div class="skeleton-dash-card"></div>
					</div>
				</div>

			<!-- Generic fallback -->
			{:else}
				<div class="skeleton-generic">
					<div class="skeleton-generic-content">
						{#each Array(3) as _, i}
							<div class="skeleton-line w-full" style="animation-delay: {i * 100}ms"></div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}

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

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes shimmer {
		0% { opacity: 0.4; }
		50% { opacity: 0.7; }
		100% { opacity: 0.4; }
	}

	/* Base Skeleton Container */
	.nav-loading-skeleton {
		position: fixed;
		inset: 0;
		right: 280px;
		background: var(--color-bg-base);
		z-index: 50;
		padding: 32px;
		overflow: hidden;
		animation: fadeIn 0.1s ease-out;
	}

	/* Header */
	.skeleton-header {
		margin-bottom: 24px;
	}

	.skeleton-title {
		width: 200px;
		height: 32px;
		background: var(--color-bg-elevated);
		border-radius: 8px;
		margin-bottom: 16px;
		animation: shimmer 1.5s infinite;
	}

	.skeleton-stats {
		display: flex;
		gap: 16px;
	}

	.skeleton-stat {
		width: 140px;
		height: 52px;
		background: var(--color-bg-card);
		border: 1px solid var(--color-glass-border);
		border-radius: 12px;
		animation: shimmer 1.5s infinite;
	}

	/* Shared line styles */
	.skeleton-line {
		height: 16px;
		background: var(--color-bg-elevated);
		border-radius: 4px;
		animation: shimmer 1.5s infinite;
	}
	.skeleton-line.w-16 { width: 64px; }
	.skeleton-line.w-24 { width: 96px; }
	.skeleton-line.w-32 { width: 128px; }
	.skeleton-line.w-full { width: 100%; }

	/* Grid Cards (PlayStation, FnB) */
	.skeleton-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 20px;
	}

	.skeleton-card {
		background: var(--color-bg-card);
		border: 1px solid var(--color-glass-border);
		border-radius: 16px;
		padding: 20px;
		opacity: 0;
		animation: fadeIn 0.3s ease forwards, shimmer 1.5s infinite;
	}

	.skeleton-card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
	}

	.skeleton-badge {
		width: 60px;
		height: 24px;
		background: var(--color-bg-elevated);
		border-radius: 12px;
	}

	.skeleton-card-body {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		margin-bottom: 20px;
	}

	.skeleton-circle {
		width: 80px;
		height: 80px;
		background: var(--color-bg-elevated);
		border-radius: 50%;
	}

	.skeleton-card-footer {
		display: flex;
		gap: 12px;
	}

	.skeleton-button {
		flex: 1;
		height: 40px;
		background: var(--color-bg-elevated);
		border-radius: 8px;
	}

	/* Table Skeleton */
	.skeleton-table-wrapper {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.skeleton-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
	}

	.skeleton-search {
		width: 280px;
		height: 44px;
		background: var(--color-bg-card);
		border: 1px solid var(--color-glass-border);
		border-radius: 10px;
		animation: shimmer 1.5s infinite;
	}

	.skeleton-filters {
		display: flex;
		gap: 12px;
	}

	.skeleton-filter {
		width: 120px;
		height: 40px;
		background: var(--color-bg-card);
		border: 1px solid var(--color-glass-border);
		border-radius: 8px;
		animation: shimmer 1.5s infinite;
	}

	.skeleton-table {
		background: var(--color-bg-card);
		border: 1px solid var(--color-glass-border);
		border-radius: 16px;
		overflow: hidden;
	}

	.skeleton-table-header {
		display: flex;
		gap: 16px;
		padding: 16px 20px;
		background: var(--color-bg-elevated);
		border-bottom: 1px solid var(--color-glass-border);
	}

	.skeleton-th {
		flex: 1;
		height: 16px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 4px;
	}

	.skeleton-table-row {
		display: flex;
		gap: 16px;
		padding: 16px 20px;
		border-bottom: 1px solid var(--color-glass-border);
		opacity: 0;
		animation: fadeIn 0.2s ease forwards;
	}

	.skeleton-table-row:last-child {
		border-bottom: none;
	}

	.skeleton-td {
		height: 16px;
		background: var(--color-bg-elevated);
		border-radius: 4px;
		animation: shimmer 1.5s infinite;
	}

	/* Network Cards (WiFi) */
	.skeleton-network-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 20px;
	}

	.skeleton-network-card {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 20px;
		background: var(--color-bg-card);
		border: 1px solid var(--color-glass-border);
		border-radius: 16px;
		opacity: 0;
		animation: fadeIn 0.3s ease forwards;
	}

	.skeleton-network-icon {
		width: 48px;
		height: 48px;
		background: var(--color-bg-elevated);
		border-radius: 12px;
		animation: shimmer 1.5s infinite;
	}

	.skeleton-network-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.skeleton-network-status {
		width: 80px;
		height: 28px;
		background: var(--color-bg-elevated);
		border-radius: 14px;
		animation: shimmer 1.5s infinite;
	}

	/* Form Skeleton (Settings) */
	.skeleton-form {
		max-width: 600px;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.skeleton-form-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
		opacity: 0;
		animation: fadeIn 0.3s ease forwards;
	}

	.skeleton-label {
		width: 100px;
		height: 16px;
		background: var(--color-bg-elevated);
		border-radius: 4px;
		animation: shimmer 1.5s infinite;
	}

	.skeleton-input {
		width: 100%;
		height: 48px;
		background: var(--color-bg-card);
		border: 1px solid var(--color-glass-border);
		border-radius: 10px;
		animation: shimmer 1.5s infinite;
	}

	.skeleton-form-actions {
		margin-top: 16px;
	}

	.skeleton-button-lg {
		width: 160px;
		height: 48px;
		background: var(--color-bg-elevated);
		border-radius: 10px;
		animation: shimmer 1.5s infinite;
	}

	/* Charts Skeleton (Analytics) */
	.skeleton-charts {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.skeleton-chart-row {
		display: flex;
		gap: 20px;
	}

	.skeleton-chart-card {
		flex: 1;
		padding: 24px;
		background: var(--color-bg-card);
		border: 1px solid var(--color-glass-border);
		border-radius: 16px;
		opacity: 0;
		animation: fadeIn 0.3s ease forwards;
	}

	.skeleton-chart-card.large {
		min-height: 300px;
	}

	.skeleton-chart-title {
		width: 120px;
		height: 20px;
		background: var(--color-bg-elevated);
		border-radius: 4px;
		margin-bottom: 16px;
		animation: shimmer 1.5s infinite;
	}

	.skeleton-chart-area {
		width: 100%;
		height: 200px;
		background: var(--color-bg-elevated);
		border-radius: 8px;
		animation: shimmer 1.5s infinite;
	}

	.skeleton-chart-value {
		width: 80px;
		height: 40px;
		background: var(--color-bg-elevated);
		border-radius: 8px;
		animation: shimmer 1.5s infinite;
	}

	/* Dashboard Skeleton */
	.skeleton-dashboard {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.skeleton-dash-stats {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 16px;
	}

	.skeleton-dash-stat {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 20px;
		background: var(--color-bg-card);
		border: 1px solid var(--color-glass-border);
		border-radius: 16px;
		opacity: 0;
		animation: fadeIn 0.3s ease forwards;
	}

	.skeleton-dash-icon {
		width: 48px;
		height: 48px;
		background: var(--color-bg-elevated);
		border-radius: 12px;
		animation: shimmer 1.5s infinite;
	}

	.skeleton-dash-info {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.skeleton-dash-grid {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr;
		gap: 20px;
	}

	.skeleton-dash-card {
		height: 200px;
		background: var(--color-bg-card);
		border: 1px solid var(--color-glass-border);
		border-radius: 16px;
		animation: shimmer 1.5s infinite;
	}

	.skeleton-dash-card.large {
		height: 300px;
	}

	/* Generic Skeleton */
	.skeleton-generic {
		padding: 20px;
	}

	.skeleton-generic-content {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 600px;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.nav-loading-skeleton {
			right: 0;
			padding: 20px;
		}

		.skeleton-grid,
		.skeleton-network-grid {
			grid-template-columns: 1fr;
		}

		.skeleton-dash-grid {
			grid-template-columns: 1fr;
		}

		.skeleton-toolbar {
			flex-direction: column;
			align-items: stretch;
		}

		.skeleton-search {
			width: 100%;
		}

		.skeleton-chart-row {
			flex-direction: column;
		}
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

	/* Hide sidebar and adjust layout for printing */
	@media print {
		.app-layout {
			display: block !important;
		}

		.app-layout > :global(.sidebar) {
			display: none !important;
		}

		.main-content {
			margin: 0 !important;
			padding: 0 !important;
			width: 100% !important;
		}

		.content-container {
			padding: 0 !important;
			max-width: 100% !important;
		}

		/* Hide toast notifications */
		:global([data-sonner-toaster]),
		:global(.sonner-toast-container) {
			display: none !important;
		}
	}
</style>
