<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { AlertTriangle, X } from 'lucide-svelte';

  let {
    open = $bindable(false),
    title = 'تأكيد',
    message = 'هل أنت متأكد؟',
    confirmText = 'تأكيد',
    cancelText = 'إلغاء',
    variant = 'destructive' as 'destructive' | 'default',
    onConfirm = () => {},
    onCancel = () => {}
  } = $props();

  function handleConfirm() {
    onConfirm();
    open = false;
  }

  function handleCancel() {
    onCancel();
    open = false;
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleCancel();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="modal-content">
      <button class="modal-close" onclick={handleCancel} aria-label="إغلاق">
        <X class="w-5 h-5" />
      </button>

      <div class="modal-icon {variant}">
        <AlertTriangle class="w-8 h-8" />
      </div>

      <h3 class="modal-title">{title}</h3>
      <p class="modal-message">{message}</p>

      <div class="modal-actions">
        <Button variant="outline" onclick={handleCancel}>
          {cancelText}
        </Button>
        <Button {variant} onclick={handleConfirm}>
          {confirmText}
        </Button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.2s ease;
  }

  .modal-content {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: 16px;
    padding: 32px;
    max-width: 400px;
    width: 90%;
    text-align: center;
    position: relative;
    animation: slideUp 0.2s ease;
  }

  .modal-close {
    position: absolute;
    top: 12px;
    left: 12px;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 8px;
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .modal-close:hover {
    background: var(--color-bg-card);
    color: var(--color-text-primary);
  }

  .modal-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 20px;
  }

  .modal-icon.destructive {
    background: rgba(239, 68, 68, 0.15);
    color: var(--color-danger);
  }

  .modal-icon.default {
    background: rgba(8, 145, 178, 0.15);
    color: var(--color-primary-light);
  }

  .modal-title {
    font-size: 20px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin-bottom: 8px;
  }

  .modal-message {
    font-size: 14px;
    color: var(--color-text-secondary);
    margin-bottom: 24px;
    line-height: 1.6;
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>
