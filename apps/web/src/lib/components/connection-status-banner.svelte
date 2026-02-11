<script lang="ts">
	import { connectionStatus, type ConnectionStatus } from '$lib/stores/connection';
	import { pendingWrites } from '$lib/offline';
	import { WifiOff, Loader2, CloudOff } from 'lucide-svelte';
	import { slide } from 'svelte/transition';

	let status = $derived($connectionStatus);
	let pendingCount = $derived($pendingWrites.filter((w) => w.status === 'pending').length);
	let failedCount = $derived($pendingWrites.filter((w) => w.status === 'failed').length);

	let showBanner = $derived(status !== 'online' || pendingCount > 0 || failedCount > 0);

	const statusConfig: Record<
		ConnectionStatus | 'pending',
		{ icon: typeof WifiOff; text: string; class: string }
	> = {
		offline: {
			icon: WifiOff,
			text: 'غير متصل بالإنترنت - التغييرات ستُحفظ محلياً',
			class: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-200'
		},
		syncing: {
			icon: Loader2,
			text: 'جاري المزامنة...',
			class: 'bg-blue-500/20 border-blue-500/30 text-blue-200'
		},
		online: {
			icon: CloudOff,
			text: 'متصل',
			class: 'bg-green-500/20 border-green-500/30 text-green-200'
		},
		pending: {
			icon: Loader2,
			text: '',
			class: 'bg-orange-500/20 border-orange-500/30 text-orange-200'
		}
	};

	let currentConfig = $derived.by(() => {
		if (status === 'offline') return statusConfig.offline;
		if (status === 'syncing') return statusConfig.syncing;
		if (pendingCount > 0 || failedCount > 0) {
			return {
				...statusConfig.pending,
				text:
					failedCount > 0
						? `${failedCount} عملية فشلت - ${pendingCount} في الانتظار`
						: `${pendingCount} عملية في انتظار المزامنة`
			};
		}
		return statusConfig.online;
	});
</script>

{#if showBanner}
	<div
		transition:slide={{ duration: 200 }}
		class="connection-banner {currentConfig.class}"
		role="status"
		aria-live="polite"
	>
		{#if status === 'offline'}
			<WifiOff class="h-4 w-4" />
		{:else if status === 'syncing'}
			<Loader2 class="h-4 w-4 animate-spin" />
		{:else if failedCount > 0 || pendingCount > 0}
			<Loader2 class="h-4 w-4" />
		{:else}
			<CloudOff class="h-4 w-4" />
		{/if}
		<span>{currentConfig.text}</span>
	</div>
{/if}

<style>
	.connection-banner {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 8px 16px;
		font-size: 14px;
		border-bottom: 1px solid;
		position: sticky;
		top: 0;
		z-index: 100;
		backdrop-filter: blur(8px);
	}
</style>
