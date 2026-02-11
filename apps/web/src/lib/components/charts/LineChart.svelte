<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    labels: string[];
    data: number[];
    label?: string;
    color?: string;
    fillColor?: string;
  }

  let { labels, data, label = '', color = '#22d3ee', fillColor = 'rgba(34, 211, 238, 0.1)' }: Props = $props();

  let canvasEl: HTMLCanvasElement;
  let chart: any = null;

  onMount(() => {
    if (!browser) return;

    (async () => {
      const { Chart, CategoryScale, LinearScale, PointElement, LineElement, LineController, Title, Tooltip, Legend, Filler } = await import('chart.js');

      Chart.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, Title, Tooltip, Legend, Filler);

      const ctx = canvasEl.getContext('2d');
      if (!ctx) return;

      chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label,
            data,
            borderColor: color,
            backgroundColor: fillColor,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: color,
            pointBorderColor: color,
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              rtl: true,
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              borderColor: 'rgba(148, 163, 184, 0.2)',
              borderWidth: 1,
              titleColor: '#f1f5f9',
              bodyColor: '#cbd5e1',
              padding: 12,
              displayColors: false
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(148, 163, 184, 0.1)' },
              ticks: { color: '#94a3b8' }
            },
            y: {
              grid: { color: 'rgba(148, 163, 184, 0.1)' },
              ticks: { color: '#94a3b8' },
              beginAtZero: true
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
