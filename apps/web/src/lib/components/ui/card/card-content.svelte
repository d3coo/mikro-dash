<script lang="ts">
  import { cn } from '$lib/utils';

  let { class: className, children, ...restProps }: { class?: string; children?: import('svelte').Snippet } & Record<string, unknown> = $props();
</script>

<div class={cn('p-5 pt-2', className)} {...restProps}>
  {@render children?.()}
</div>
