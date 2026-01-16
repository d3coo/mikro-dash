<script lang="ts">
  let { children } = $props();
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
</svelte:head>

<!-- Simple layout without sidebar for print page -->
<div class="print-layout">
  {@render children()}
</div>

<style>
  .print-layout {
    min-height: 100vh;
    background: #0f172a;
  }

  @media print {
    .print-layout {
      background: white !important;
    }
  }
</style>
