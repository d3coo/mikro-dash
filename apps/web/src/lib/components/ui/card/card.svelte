<script lang="ts">
  import { cn } from '$lib/utils';

  let { class: className, children, ...restProps }: { class?: string; children?: import('svelte').Snippet } & Record<string, unknown> = $props();
</script>

<div class={cn('glass-card p-1', className)} {...restProps}>
  {@render children?.()}
</div>
