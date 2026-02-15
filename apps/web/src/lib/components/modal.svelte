<script lang="ts">
  import { X } from 'lucide-svelte';
  import type { Snippet } from 'svelte';

  let {
    open = $bindable(false),
    title = '',
    size = 'default' as 'sm' | 'default' | 'lg',
    showClose = true,
    onClose = () => {},
    header,
    children,
    footer
  }: {
    open?: boolean;
    title?: string;
    size?: 'sm' | 'default' | 'lg';
    showClose?: boolean;
    onClose?: () => void;
    header?: Snippet;
    children: Snippet;
    footer?: Snippet;
  } = $props();

  function handleClose() {
    onClose();
    open = false;
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleClose();
    }
  }

  const sizeClasses = {
    sm: 'modal-box-sm',
    default: '',
    lg: 'modal-box-lg'
  };
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div
    class="modal-overlay"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="modal-box {sizeClasses[size]}">
      {#if header}
        {@render header()}
      {:else if title || showClose}
        <div class="modal-header">
          {#if title}
            <h3>{title}</h3>
          {:else}
            <div></div>
          {/if}
          {#if showClose}
            <button class="modal-close-btn" onclick={handleClose} aria-label="إغلاق">
              <X class="w-5 h-5" />
            </button>
          {/if}
        </div>
      {/if}

      <div class="modal-body">
        {@render children()}
      </div>

      {#if footer}
        <div class="modal-footer">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}
