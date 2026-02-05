<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    labels: string[];
    data: number[];
    colors?: string[];
  }

  // Default color palette
  const defaultColors = [
    '#22d3ee', // cyan
    '#a78bfa', // purple
    '#f472b6', // pink
    '#34d399', // green
    '#fbbf24', // yellow
    '#f87171', // red
    '#60a5fa', // blue
    '#fb923c'  // orange
  ];

  let { labels, data, colors = defaultColors }: Props = $props();

  let canvasEl: HTMLCanvasElement;
  let chart: any = null;

  onMount(() => {
    if (!browser) return;

    (async () => {
      const { Chart, ArcElement, DoughnutController, Title, Tooltip, Legend } = await import('chart.js');

      Chart.register(ArcElement, DoughnutController, Title, Tooltip, Legend);

      const ctx = canvasEl.getContext('2d');
      if (!ctx) return;

      chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: colors.slice(0, data.length),
            borderColor: 'rgba(15, 23, 42, 0.8)',
            borderWidth: 2,
            hoverBorderColor: '#fff',
            hoverBorderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '60%',
          plugins: {
            legend: {
              display: true,
              position: 'right',
              rtl: true,
              labels: {
                color: '#94a3b8',
                padding: 12,
                usePointStyle: true,
                pointStyle: 'circle'
              }
            },
            tooltip: {
              rtl: true,
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              borderColor: 'rgba(148, 163, 184, 0.2)',
              borderWidth: 1,
              titleColor: '#f1f5f9',
              bodyColor: '#cbd5e1',
              padding: 12
            }
          }
        }
      });
    })();
  });

  onDestroy(() => {
    if (chart) chart.destroy();
  });
</script>

<div class="chart-container">
  <canvas bind:this={canvasEl}></canvas>
</div>

<style>
  .chart-container {
    position: relative;
    height: 250px;
    width: 100%;
  }
</style>
