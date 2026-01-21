<script lang="ts">
  import { Wifi, Gamepad2, Coffee, TrendingUp, TrendingDown } from 'lucide-svelte';
  import type { Component as SvelteComponent } from 'svelte';

  type SegmentType = 'wifi' | 'playstation' | 'fnb';

  let {
    segment,
    revenue,
    expenses,
    profit,
    contribution,
    metrics = []
  }: {
    segment: SegmentType;
    revenue: number;      // Piasters
    expenses: number;     // Piasters
    profit: number;       // Piasters
    contribution: number; // %
    metrics?: Array<{ label: string; value: string }>;
  } = $props();

  // Format currency (piasters to EGP)
  function formatCurrency(piasters: number): string {
    return `${(piasters / 100).toFixed(0)} ج.م`;
  }

  const segmentConfig: Record<SegmentType, { name: string; icon: typeof Wifi; color: string; bgColor: string; borderColor: string }> = {
    wifi: {
      name: 'WiFi',
      icon: Wifi,
      color: '#22d3ee',
      bgColor: 'rgba(34, 211, 238, 0.1)',
      borderColor: 'rgba(34, 211, 238, 0.3)'
    },
    playstation: {
      name: 'PlayStation',
      icon: Gamepad2,
      color: '#a78bfa',
      bgColor: 'rgba(167, 139, 250, 0.1)',
      borderColor: 'rgba(167, 139, 250, 0.3)'
    },
    fnb: {
      name: 'مأكولات ومشروبات',
      icon: Coffee,
      color: '#fbbf24',
      bgColor: 'rgba(251, 191, 36, 0.1)',
      borderColor: 'rgba(251, 191, 36, 0.3)'
    }
  };

  const config = $derived(segmentConfig[segment]);
  const isProfit = $derived(profit >= 0);
</script>

<div class="segment-card glass-card" style="--segment-color: {config.color}; --segment-bg: {config.bgColor}; --segment-border: {config.borderColor};">
  <!-- Header -->
  <div class="segment-header">
    <div class="segment-icon">
      <svelte:component this={config.icon} class="w-5 h-5" style="color: {config.color}" />
    </div>
    <div class="segment-info">
      <h3 class="segment-name">{config.name}</h3>
      {#if contribution > 0}
        <span class="contribution-badge">{contribution}%</span>
      {/if}
    </div>
  </div>

  <!-- Main Stats -->
  <div class="segment-stats">
    <div class="stat-row">
      <span class="stat-label">الإيرادات</span>
      <span class="stat-value revenue">{formatCurrency(revenue)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">المصروفات</span>
      <span class="stat-value expenses">{formatCurrency(expenses)}</span>
    </div>
    <div class="stat-row profit-row">
      <span class="stat-label">الربح</span>
      <span class="stat-value profit {isProfit ? 'positive' : 'negative'}">
        {#if isProfit}
          <TrendingUp class="w-4 h-4 inline" />
        {:else}
          <TrendingDown class="w-4 h-4 inline" />
        {/if}
        {formatCurrency(Math.abs(profit))}
      </span>
    </div>
  </div>

  <!-- Additional Metrics -->
  {#if metrics.length > 0}
    <div class="segment-metrics">
      {#each metrics as metric}
        <div class="metric">
          <span class="metric-label">{metric.label}</span>
          <span class="metric-value">{metric.value}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .segment-card {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    position: relative;
    overflow: hidden;
  }

  .segment-card::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 4px;
    height: 100%;
    background: var(--segment-color);
    border-radius: 0 0.75rem 0.75rem 0;
  }

  .segment-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .segment-icon {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--segment-bg);
    border: 1px solid var(--segment-border);
  }

  .segment-info {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .segment-name {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .contribution-badge {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    border-radius: 9999px;
    background: var(--segment-bg);
    color: var(--segment-color);
    border: 1px solid var(--segment-border);
  }

  .segment-stats {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.25rem 0;
  }

  .profit-row {
    padding-top: 0.5rem;
    border-top: 1px solid var(--border-glass);
  }

  .stat-label {
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .stat-value {
    font-size: 0.9375rem;
    font-weight: 600;
  }

  .stat-value.revenue {
    color: #34d399;
  }

  .stat-value.expenses {
    color: #f87171;
  }

  .stat-value.profit {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .stat-value.profit.positive {
    color: #34d399;
  }

  .stat-value.profit.negative {
    color: #f87171;
  }

  .segment-metrics {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border-glass);
  }

  .metric {
    flex: 1;
    min-width: 80px;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .metric-label {
    font-size: 0.6875rem;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .metric-value {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
  }
</style>
