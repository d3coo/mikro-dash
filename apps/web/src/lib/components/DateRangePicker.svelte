<script lang="ts">
  import { Calendar } from 'lucide-svelte';

  export type TimePeriod = 'today' | 'week' | 'month' | 'custom';

  let {
    period = $bindable('today' as TimePeriod),
    startDate = $bindable(''),
    endDate = $bindable(''),
    onPeriodChange = (p: TimePeriod, s?: string, e?: string) => {}
  }: {
    period?: TimePeriod;
    startDate?: string;
    endDate?: string;
    onPeriodChange?: (period: TimePeriod, start?: string, end?: string) => void;
  } = $props();

  let showCustomRange = $state(false);
  let customStart = $state('');
  let customEnd = $state('');

  const periods = [
    { id: 'today' as TimePeriod, label: 'اليوم' },
    { id: 'week' as TimePeriod, label: 'الأسبوع' },
    { id: 'month' as TimePeriod, label: 'الشهر' }
  ];

  function selectPeriod(p: TimePeriod) {
    if (p === 'custom') {
      showCustomRange = true;
      return;
    }
    period = p;
    showCustomRange = false;
    onPeriodChange(p);
  }

  function applyCustomRange() {
    if (customStart && customEnd) {
      period = 'custom';
      startDate = customStart;
      endDate = customEnd;
      showCustomRange = false;
      onPeriodChange('custom', customStart, customEnd);
    }
  }

  function cancelCustomRange() {
    showCustomRange = false;
    customStart = '';
    customEnd = '';
  }

  // Initialize custom dates when opening picker
  $effect(() => {
    if (showCustomRange && !customStart && !customEnd) {
      const today = new Date().toISOString().split('T')[0];
      customEnd = today;
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 6);
      customStart = weekAgo.toISOString().split('T')[0];
    }
  });
</script>

<div class="date-range-picker">
  <div class="period-tabs">
    {#each periods as p}
      <button
        class="period-tab {period === p.id ? 'active' : ''}"
        onclick={() => selectPeriod(p.id)}
      >
        {p.label}
      </button>
    {/each}
    <button
      class="period-tab {period === 'custom' || showCustomRange ? 'active' : ''}"
      onclick={() => selectPeriod('custom')}
      title="نطاق مخصص"
    >
      <Calendar class="w-4 h-4" />
    </button>
  </div>

  {#if showCustomRange}
    <div class="custom-range-popup">
      <div class="custom-range-content">
        <div class="date-inputs">
          <div class="date-field">
            <label for="custom-start">من</label>
            <input
              id="custom-start"
              type="date"
              bind:value={customStart}
              class="date-input"
            />
          </div>
          <div class="date-field">
            <label for="custom-end">إلى</label>
            <input
              id="custom-end"
              type="date"
              bind:value={customEnd}
              class="date-input"
            />
          </div>
        </div>
        <div class="custom-range-actions">
          <button class="btn btn-neutral btn-sm" onclick={cancelCustomRange}>
            إلغاء
          </button>
          <button class="btn btn-primary btn-sm" onclick={applyCustomRange}>
            تطبيق
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if period === 'custom' && startDate && endDate && !showCustomRange}
    <div class="custom-range-display">
      {startDate} - {endDate}
    </div>
  {/if}
</div>

<style>
  .date-range-picker {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .period-tabs {
    display: flex;
    flex-direction: row-reverse;
    background: var(--bg-glass);
    border-radius: 0.75rem;
    padding: 0.25rem;
    border: 1px solid var(--border-glass);
  }

  .period-tab {
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
    transition: all 0.2s ease;
    background: transparent;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .period-tab:hover {
    color: #f1f5f9;
    background: rgba(34, 211, 238, 0.1);
  }

  .period-tab.active {
    background: #0891b2 !important;
    color: white !important;
    box-shadow: 0 0 12px rgba(34, 211, 238, 0.3);
  }

  .custom-range-popup {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 0.5rem;
    z-index: 50;
  }

  .custom-range-content {
    background: var(--bg-card);
    border: 1px solid var(--border-glass);
    border-radius: 0.75rem;
    padding: 1rem;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    min-width: 280px;
  }

  .date-inputs {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .date-field {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .date-field label {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .date-input {
    padding: 0.5rem;
    background: var(--bg-glass);
    border: 1px solid var(--border-glass);
    border-radius: 0.5rem;
    color: var(--text-primary);
    font-size: 0.875rem;
  }

  .date-input:focus {
    outline: none;
    border-color: var(--primary);
  }

  .custom-range-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .custom-range-display {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    background: var(--bg-glass);
    padding: 0.375rem 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid var(--border-glass);
  }

  .btn {
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
  }

  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
  }

  .btn-primary {
    background: var(--primary);
    color: white;
  }

  .btn-primary:hover {
    background: var(--primary-dark);
  }

  .btn-neutral {
    background: var(--bg-glass);
    color: var(--text-secondary);
    border: 1px solid var(--border-glass);
  }

  .btn-neutral:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
</style>
