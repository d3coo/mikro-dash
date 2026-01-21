<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';

  interface DataSet {
    label: string;
    data: number[];
    color: string;
  }

  interface Props {
    labels: string[];
    datasets: DataSet[];
    stacked?: boolean;
  }

  let { labels, datasets, stacked = false }: Props = $props();

  let canvasEl: HTMLCanvasElement;
  let chart: any = null;

  onMount(async () => {
    if (!browser) return;

    const { Chart, CategoryScale, LinearScale, BarElement, BarController, Title, Tooltip, Legend } = await import('chart.js');

    Chart.register(CategoryScale, LinearScale, BarElement, BarController, Title, Tooltip, Legend);

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: datasets.map(ds => ({
          label: ds.label,
          data: ds.data,
          backgroundColor: ds.color,
          borderColor: ds.color,
          borderRadius: 4,
          borderWidth: 0
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            rtl: true,
            labels: {
              color: '#94a3b8',
              padding: 16,
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
        },
        scales: {
          x: {
            grid: { color: 'rgba(148, 163, 184, 0.1)' },
            ticks: { color: '#94a3b8' },
            stacked: stacked
          },
          y: {
            grid: { color: 'rgba(148, 163, 184, 0.1)' },
            ticks: { color: '#94a3b8' },
            beginAtZero: true,
            stacked: stacked
          }
        }
      }
    });

    return () => {
      if (chart) chart.destroy();
    };
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
