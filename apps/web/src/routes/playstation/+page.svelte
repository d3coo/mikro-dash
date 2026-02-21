<script lang="ts">
  import { Gamepad2, Play, Square, Clock, Settings, RefreshCw, Timer, Banknote, Activity, Wifi, WifiOff, AlertTriangle, History, TrendingUp, UtensilsCrossed, Plus, Minus, X, Bell, Coffee, Power, Volume2, Monitor, Tv, MonitorOff, Users, User, ArrowRightLeft, DollarSign, Pencil, Trash2, Repeat, Globe } from 'lucide-svelte';
  import { onMount, onDestroy } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { invalidateAll } from '$app/navigation';
  import { enhance } from '$app/forms';
  import { browser } from '$app/environment';
  import { createPsConvexState, type StationStatus as ConvexStationStatus } from '$lib/playstation/convex-state.svelte';
  // IDs are now strings (SQLite integer IDs converted to strings)

  let { data } = $props();

  // ===== CONVEX REAL-TIME STATE =====
  // Convex provides real-time updates with automatic caching for offline support
  // The convex state returns undefined when not ready, allowing safe fallback to server data
  const convex = browser ? createPsConvexState() : null;

  // Use Convex data when available, fall back to server data
  // Convex getters return undefined when not ready (loading, error, or no data)
  let stationStatuses = $derived(convex?.stationStatuses ?? data.stationStatuses);
  let menuItems = $derived(convex?.menuItems ?? data.menuItems);
  let analytics = $derived(convex?.analytics ?? data.analytics);
  let isConvexReady = $derived(convex?.isReady ?? false);

  // ===== NOTIFICATION SOUND SYSTEM =====
  let audioContext: AudioContext | null = null;
  let notifiedTimerIds = $state(new Set<number>()); // Track which timers already played sound
  let soundEnabled = $state(true);

  // ===== MONITOR CONTROL =====
  let monitorControlLoading = $state<string | null>(null); // stationId being controlled

  async function controlMonitor(stationId: string, action: 'screen_on' | 'screen_off' | 'hdmi_switch') {
    monitorControlLoading = stationId;
    try {
      const response = await fetch('/api/playstation/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, stationId })
      });

      const result = await response.json();

      if (result.success) {
        const actionNames: Record<string, string> = {
          screen_on: 'Screen turned on',
          screen_off: 'Screen turned off',
          hdmi_switch: 'HDMI switched'
        };
        toast.success(actionNames[action] || 'Action completed');
      } else {
        toast.error(`Failed: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      toast.error('Failed to control monitor');
    } finally {
      monitorControlLoading = null;
    }
  }

  // ===== INTERNET ACCESS TOGGLE =====
  let internetToggleLoading = $state<string | null>(null);

  async function toggleInternet(stationId: string, currentState: boolean) {
    internetToggleLoading = stationId;
    try {
      const response = await fetch('/api/playstation/internet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stationId, enable: !currentState })
      });

      const result = await response.json();

      if (result.success) {
        toast.success(result.enabled ? 'تم تفعيل الإنترنت' : 'تم إيقاف الإنترنت');
      } else {
        toast.error(`فشل: ${result.error || 'خطأ غير معروف'}`);
      }
    } catch (err) {
      toast.error('فشل في تبديل الإنترنت');
    } finally {
      internetToggleLoading = null;
    }
  }

  // ===== ORDER REMOVAL =====
  async function removeOrder(orderId: number | string) {
    // Use Convex mutation if available
    if (convex) {
      await convex.removeOrder(String(orderId));
      return; // Convex will update the UI automatically via subscription
    }

    // Fallback to form action
    try {
      const formData = new FormData();
      formData.append('orderId', orderId.toString());

      const response = await fetch('?/removeOrder', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.type === 'success') {
        toast.success('تم حذف الطلب');
        await invalidateAll();
      } else {
        toast.error('فشل في حذف الطلب');
      }
    } catch (err) {
      toast.error('فشل في حذف الطلب');
    }
  }

  // Initialize audio context (must be after user interaction)
  function initAudioContext() {
    if (!browser || audioContext) return;
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  }

  // Play a single train horn blast
  function playHornBlast(startTime: number) {
    if (!audioContext) return;

    const masterGain = audioContext.createGain();
    masterGain.connect(audioContext.destination);
    masterGain.gain.value = 0.6;

    // Train horn frequencies (two-tone like real train horns)
    const hornFrequencies = [
      { freq: 277, gain: 1.0 },    // Main low tone
      { freq: 349, gain: 0.8 },    // Second tone (major third up)
      { freq: 554, gain: 0.3 },    // Harmonic
      { freq: 698, gain: 0.2 },    // Higher harmonic
    ];

    hornFrequencies.forEach(({ freq, gain }) => {
      const oscillator = audioContext!.createOscillator();
      const gainNode = audioContext!.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(masterGain);

      // Sawtooth wave for that brassy horn sound
      oscillator.type = 'sawtooth';
      oscillator.frequency.value = freq;

      // Horn envelope: quick attack, sustain, quick release
      const blastDuration = 0.4;
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.02);
      gainNode.gain.setValueAtTime(gain, startTime + blastDuration - 0.05);
      gainNode.gain.linearRampToValueAtTime(0, startTime + blastDuration);

      oscillator.start(startTime);
      oscillator.stop(startTime + blastDuration + 0.1);
    });
  }

  // Play notification sound using Web Audio API - TRAIN HORN
  function playNotificationSound() {
    if (!browser || !soundEnabled) return;

    // Initialize on first play (requires user interaction)
    if (!audioContext) {
      initAudioContext();
    }

    if (!audioContext) return;

    try {
      // Resume context if suspended (browser autoplay policy)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const now = audioContext.currentTime;

      // Play 3 horn blasts with gaps
      playHornBlast(now);
      playHornBlast(now + 0.5);
      playHornBlast(now + 1.0);

      // Repeat the whole sequence 2 more times (total 3 rounds = 9 blasts)
      setTimeout(() => {
        if (!audioContext || audioContext.state !== 'running' || !soundEnabled) return;
        const now2 = audioContext.currentTime;
        playHornBlast(now2);
        playHornBlast(now2 + 0.5);
        playHornBlast(now2 + 1.0);
      }, 2000);

      setTimeout(() => {
        if (!audioContext || audioContext.state !== 'running' || !soundEnabled) return;
        const now3 = audioContext.currentTime;
        playHornBlast(now3);
        playHornBlast(now3 + 0.5);
        playHornBlast(now3 + 1.0);
      }, 4000);

    } catch (e) {
      console.warn('Failed to play notification sound:', e);
    }
  }

  // Toggle sound on/off
  function toggleSound() {
    soundEnabled = !soundEnabled;
    if (soundEnabled) {
      initAudioContext();
      playNotificationSound(); // Play test sound
      toast.success('تم تفعيل صوت التنبيه');
    } else {
      toast.success('تم إيقاف صوت التنبيه');
    }
  }

  // Auto-refresh state
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let isSyncing = $state(false);
  let currentTime = $state(Date.now());

  // Modal states
  let showOrderModal = $state(false);
  let showDurationModal = $state(false);
  let showTimerModal = $state(false);
  let showEndSessionModal = $state(false);
  let showZeroConfirmModal = $state(false);
  let showChargeModal = $state(false);
  let showTransferModal = $state(false);
  // ID type union to support both SQLite (number) and Convex (string) IDs
  type AnyId = string | number;

  let activeStationForOrder = $state<{ stationId: string; sessionId: AnyId } | null>(null);
  let activeStationForStart = $state<string | null>(null);
  let activeSessionForTimer = $state<AnyId | null>(null);
  let activeSessionForEnd = $state<{
    sessionId: AnyId;
    stationName: string;
    calculatedCost: number;
    ordersTotal: number;
    extraCharges: number;
    transferredCost: number;
    costBreakdown: Array<{ mode: string; minutes: number; cost: number }> | null;
  } | null>(null);
  let activeSessionForCharge = $state<{ sessionId: AnyId; stationName: string } | null>(null);
  let activeSessionForTransfer = $state<{ sessionId: AnyId; stationId: string; stationName: string; gamingCost: number; ordersCost: number } | null>(null);
  let orderCart = $state<Map<AnyId, number>>(new Map()); // itemId -> quantity
  let selectedDuration = $state<number | null>(null);
  let selectedCostLimit = $state<number | null>(null); // Cost limit in EGP
  let customStartTimeHour = $state<string>(''); // Hour for custom start (HH:mm format)
  let showEditStartTimeModal = $state(false);
  let editStartTimeSessionId = $state<AnyId | null>(null);
  let editStartTimeHour = $state<string>(''); // Hour (01-12) for editing
  let editStartTimeMinute = $state<string>(''); // Minute (00-59) for editing
  let editStartTimePeriod = $state<'AM' | 'PM'>('AM'); // AM/PM for editing
  let endSessionMode = $state<'rounded' | 'zero' | 'custom'>('rounded');
  let customAmount = $state('');

  // Charge modal state
  let chargeAmount = $state('');
  let chargeReason = $state('');
  let editingChargeId = $state<AnyId | null>(null);

  // Transfer modal state
  let transferTargetSessionId = $state<AnyId | null>(null);
  let transferIncludeOrders = $state(true);

  // Switch station modal state
  let showSwitchStationModal = $state(false);
  let activeSessionForSwitch = $state<{ sessionId: AnyId; currentStationId: string; stationName: string } | null>(null);
  let switchTargetStationId = $state<string | null>(null);

  // Sync router rules manually
  async function syncRouterRules() {
    isSyncing = true;
    try {
      const res = await fetch('/api/playstation/sync', { method: 'POST' });
      if (res.ok) {
        toast.success('تم مزامنة قواعد الراوتر');
      } else {
        toast.error('فشل في المزامنة');
      }
    } catch (e) {
      toast.error('فشل في المزامنة');
    } finally {
      isSyncing = false;
    }
  }

  // Auto-refresh for fast UI updates
  onMount(() => {
    // Initialize audio context on first user interaction
    const initAudio = () => {
      initAudioContext();
      document.removeEventListener('click', initAudio);
    };
    document.addEventListener('click', initAudio);

    // Check for already expired timers from server on initial load
    if (data.timerAlerts && data.timerAlerts.length > 0) {
      // Play sound for alerts that came from server
      data.timerAlerts.forEach((alert: any) => {
        if (!notifiedTimerIds.has(alert.sessionId)) {
          notifiedTimerIds.add(alert.sessionId);
          // Delay sound to allow audio context init
          setTimeout(() => playNotificationSound(), 500);
        }
      });
    }

    // Convex handles real-time updates via WebSocket - no need for polling/invalidateAll.
    // Only keep timer countdown and sync status polling.

    // Update timers every second
    timerInterval = setInterval(() => {
      currentTime = Date.now();
      checkForExpiredTimers(); // Check for newly expired timers
    }, 1000);

  });

  onDestroy(() => {
    if (timerInterval) clearInterval(timerInterval);
  });

  // Check for timers that just expired during live countdown
  function checkForExpiredTimers() {
    if (!stationStatuses) return;

    for (const status of stationStatuses as any[]) {
      if (status.activeSession?.timerMinutes && !status.activeSession.timerNotified) {
        // Skip if paused - don't expire timer while paused
        if (status.isPaused) continue;

        // Calculate elapsed accounting for paused time
        let elapsedMs = currentTime - status.activeSession.startedAt;
        const totalPausedMs = status.activeSession.totalPausedMs || 0;
        elapsedMs -= totalPausedMs;
        if (elapsedMs < 0) elapsedMs = 0;

        const elapsed = elapsedMs / 60000; // minutes
        const remaining = status.activeSession.timerMinutes - elapsed;

        // Timer just expired (within last 2 seconds to catch it)
        if (remaining <= 0 && remaining > -2/60) {
          const sessionId = status.activeSession.id;
          if (!notifiedTimerIds.has(sessionId)) {
            notifiedTimerIds.add(sessionId);
            playNotificationSound();
            // Show toast notification too
            toast.warning(`⏰ انتهى وقت ${status.station.name}!`, {
              duration: 10000
            });

            // Notify the Android monitor if configured
            if (status.station.monitorIp) {
              fetch('/api/playstation/monitor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'timer_expired',
                  stationId: status.station.id
                })
              }).catch(err => console.error('[MonitorControl] Timer expired notification failed:', err));
            }
          }
        }
      }
    }
  }


  // Format elapsed time (accounting for paused time)
  function formatElapsed(session: { startedAt: number; pausedAt?: number | null; totalPausedMs?: number | null }): string {
    let elapsed = currentTime - session.startedAt;

    // Subtract paused time
    const totalPausedMs = session.totalPausedMs || 0;
    const currentlyPausedMs = session.pausedAt ? (currentTime - session.pausedAt) : 0;
    elapsed -= (totalPausedMs + currentlyPausedMs);
    if (elapsed < 0) elapsed = 0;

    const hours = Math.floor(elapsed / (1000 * 60 * 60));
    const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  // Calculate current cost in EGP (accounting for paused time)
  function calculateCost(session: { startedAt: number; pausedAt?: number | null; totalPausedMs?: number | null }, hourlyRate: number): string {
    let elapsed = currentTime - session.startedAt;

    // Subtract paused time
    const totalPausedMs = session.totalPausedMs || 0;
    const currentlyPausedMs = session.pausedAt ? (currentTime - session.pausedAt) : 0;
    elapsed -= (totalPausedMs + currentlyPausedMs);
    if (elapsed < 0) elapsed = 0;

    const minutes = Math.ceil(elapsed / (1000 * 60));
    const cost = (hourlyRate * minutes) / 60 / 100; // Convert from piasters
    return cost.toFixed(1);
  }

  // Format hourly rate from piasters to EGP
  function formatRate(piasters: number): string {
    return (piasters / 100).toFixed(0);
  }

  // Format revenue from piasters to EGP
  function formatRevenue(piasters: number): string {
    return (piasters / 100).toFixed(1);
  }

  // Get status color
  function getStatusColor(status: string, isOnline: boolean, isOfflineWithSession: boolean): string {
    if (status === 'maintenance') return 'maintenance';
    if (isOfflineWithSession) return 'offline-session';  // RED - device off but session running
    if (status === 'occupied') return 'occupied';
    return 'available';
  }

  // Get status text
  function getStatusText(status: string, isOnline: boolean, isOfflineWithSession: boolean): string {
    if (status === 'maintenance') return 'صيانة';
    if (isOfflineWithSession) return 'غير متصل';  // Disconnected
    if (status === 'occupied') return 'مشغول';
    return 'متاح';
  }

  // Stats (using Convex data when available)
  let occupiedCount = $derived(stationStatuses?.filter((s: any) => s.station.status === 'occupied').length ?? 0);
  let availableCount = $derived(stationStatuses?.filter((s: any) => s.station.status === 'available').length ?? 0);
  let maintenanceCount = $derived(stationStatuses?.filter((s: any) => s.station.status === 'maintenance').length ?? 0);

  // Timer remaining (accounting for paused time)
  function getTimerRemaining(session: { startedAt: number; timerMinutes?: number | null; pausedAt?: number | null; totalPausedMs?: number | null }): { text: string; isExpired: boolean; isPaused: boolean } | null {
    if (!session.timerMinutes) return null;

    let elapsedMs = currentTime - session.startedAt;
    // Subtract paused time
    const totalPausedMs = session.totalPausedMs || 0;
    const currentlyPausedMs = session.pausedAt ? (currentTime - session.pausedAt) : 0;
    elapsedMs -= (totalPausedMs + currentlyPausedMs);
    if (elapsedMs < 0) elapsedMs = 0;

    const elapsed = elapsedMs / 60000; // minutes
    const remaining = session.timerMinutes - elapsed;
    const isPaused = !!session.pausedAt;

    if (remaining <= 0) {
      return { text: 'انتهى الوقت', isExpired: true, isPaused };
    }
    const mins = Math.floor(remaining);
    const secs = Math.floor((remaining - mins) * 60);
    return { text: `${mins}:${secs.toString().padStart(2, '0')}`, isExpired: false, isPaused };
  }

  // Format time for session start/end (English format)
  function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  // Calculate orders total
  function getOrdersTotal(orders: Array<{ quantity: number; priceSnapshot: number }>): number {
    return orders.reduce((sum, o) => sum + (o.quantity * o.priceSnapshot), 0);
  }

  // Open order modal
  function openOrderModal(stationId: string, sessionId: AnyId) {
    activeStationForOrder = { stationId, sessionId };
    orderCart = new Map();
    showOrderModal = true;
  }

  // Close order modal
  function closeOrderModal() {
    showOrderModal = false;
    activeStationForOrder = null;
    orderCart = new Map();
  }

  // Add item to cart or increment quantity
  function addToCart(itemId: AnyId) {
    const current = orderCart.get(itemId) || 0;
    orderCart = new Map(orderCart).set(itemId, current + 1);
  }

  // Remove one item from cart or decrement quantity
  function removeFromCart(itemId: AnyId) {
    const current = orderCart.get(itemId) || 0;
    if (current <= 1) {
      const newCart = new Map(orderCart);
      newCart.delete(itemId);
      orderCart = newCart;
    } else {
      orderCart = new Map(orderCart).set(itemId, current - 1);
    }
  }

  // Get total cart value
  function getCartTotal(): number {
    let total = 0;
    orderCart.forEach((qty, itemId) => {
      const item = menuItems?.find(m => m.id === itemId);
      if (item) total += item.price * qty;
    });
    return total;
  }

  // Get cart item count
  function getCartCount(): number {
    let count = 0;
    orderCart.forEach((qty) => count += qty);
    return count;
  }

  // Open duration modal for starting session
  function openDurationModal(stationId: string) {
    activeStationForStart = stationId;
    selectedDuration = null;
    selectedCostLimit = null;
    customStartTimeHour = '';
    showDurationModal = true;
  }

  // Close duration modal
  function closeDurationModal() {
    showDurationModal = false;
    activeStationForStart = null;
    selectedDuration = null;
    selectedCostLimit = null;
    customStartTimeHour = '';
  }

  // Open edit start time modal
  function openEditStartTimeModal(sessionId: AnyId, currentStartTime: number) {
    editStartTimeSessionId = sessionId;
    // Convert timestamp to 12-hour format
    const date = new Date(currentStartTime);
    let h = date.getHours();
    editStartTimePeriod = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12; // Convert 0→12, 13→1, etc.
    editStartTimeHour = h.toString().padStart(2, '0');
    editStartTimeMinute = date.getMinutes().toString().padStart(2, '0');
    showEditStartTimeModal = true;
  }

  // Close edit start time modal
  function closeEditStartTimeModal() {
    showEditStartTimeModal = false;
    editStartTimeSessionId = null;
    editStartTimeHour = '';
    editStartTimeMinute = '';
    editStartTimePeriod = 'AM';
  }

  // Convert 12-hour components to 24-hour time string
  function to24h(hour: string, minute: string, period: 'AM' | 'PM'): string {
    let h = parseInt(hour, 10);
    if (period === 'AM' && h === 12) h = 0;
    else if (period === 'PM' && h !== 12) h += 12;
    return `${h.toString().padStart(2, '0')}:${minute}`;
  }

  // Convert time string (HH:mm 24h) to today's timestamp (or yesterday if result would be in the future)
  function timeToTodayTimestamp(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    if (d.getTime() > Date.now()) {
      d.setDate(d.getDate() - 1);
    }
    return d.getTime();
  }

  // Open timer modal for active session
  function openTimerModal(sessionId: AnyId, currentTimer: number | null, currentCostLimitPiasters: number | null) {
    activeSessionForTimer = sessionId;
    selectedDuration = currentTimer;
    selectedCostLimit = currentCostLimitPiasters ? currentCostLimitPiasters / 100 : null;
    showTimerModal = true;
  }

  // Close timer modal
  function closeTimerModal() {
    showTimerModal = false;
    activeSessionForTimer = null;
    selectedDuration = null;
    selectedCostLimit = null;
  }

  // Open end session modal
  function openEndSessionModal(
    sessionId: AnyId,
    stationName: string,
    calculatedCost: number,
    ordersTotal: number,
    extraCharges: number = 0,
    transferredCost: number = 0,
    costBreakdown: Array<{ mode: string; minutes: number; cost: number }> | null = null
  ) {
    activeSessionForEnd = { sessionId, stationName, calculatedCost, ordersTotal, extraCharges, transferredCost, costBreakdown };
    endSessionMode = 'rounded';
    customAmount = '';
    showEndSessionModal = true;
  }

  // Close end session modal
  function closeEndSessionModal() {
    showEndSessionModal = false;
    activeSessionForEnd = null;
    endSessionMode = 'rounded';
    customAmount = '';
  }

  // Round to nearest (e.g., 51 → 50, 57 → 55, 53 → 50)
  function roundToNearest(value: number, nearest: number = 5): number {
    return Math.round(value / nearest) * nearest;
  }

  // Get the final cost based on mode
  function getFinalCost(): number {
    if (!activeSessionForEnd) return 0;
    const totalCost = activeSessionForEnd.calculatedCost +
                      activeSessionForEnd.ordersTotal +
                      activeSessionForEnd.extraCharges +
                      activeSessionForEnd.transferredCost;

    if (endSessionMode === 'zero') return 0;
    if (endSessionMode === 'custom') {
      const parsed = parseFloat(customAmount);
      return isNaN(parsed) ? totalCost : parsed * 100; // Convert to piasters
    }
    // Rounded mode - round to nearest 5
    return roundToNearest(totalCost, 500); // 500 piasters = 5 EGP
  }

  // Handle zero confirmation
  function confirmZeroAmount() {
    showZeroConfirmModal = false;
    // The form will be submitted with 0 cost
  }

  // Get menu items grouped by category
  let menuByCategory = $derived({
    drinks: menuItems?.filter(m => m.category === 'drinks' && m.isAvailable) || [],
    food: menuItems?.filter(m => m.category === 'food' && m.isAvailable) || [],
    snacks: menuItems?.filter(m => m.category === 'snacks' && m.isAvailable) || []
  });

  // Open charge modal
  function openChargeModal(sessionId: AnyId, stationName: string, chargeToEdit?: { id: AnyId; amount: number; reason: string | null }) {
    activeSessionForCharge = { sessionId, stationName };
    if (chargeToEdit) {
      editingChargeId = chargeToEdit.id;
      chargeAmount = (chargeToEdit.amount / 100).toString();
      chargeReason = chargeToEdit.reason || '';
    } else {
      editingChargeId = null;
      chargeAmount = '';
      chargeReason = '';
    }
    showChargeModal = true;
  }

  function closeChargeModal() {
    showChargeModal = false;
    activeSessionForCharge = null;
    chargeAmount = '';
    chargeReason = '';
    editingChargeId = null;
  }

  // Delete charge
  async function deleteChargeHandler(chargeId: AnyId) {
    try {
      const formData = new FormData();
      formData.append('chargeId', chargeId.toString());

      const response = await fetch('?/deleteCharge', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.type === 'success') {
        toast.success('تم حذف الرسوم');
        await invalidateAll();
      } else {
        toast.error('فشل في حذف الرسوم');
      }
    } catch (err) {
      toast.error('فشل في حذف الرسوم');
    }
  }

  // Open transfer modal
  function openTransferModal(sessionId: AnyId, stationId: string, stationName: string, gamingCost: number, ordersCost: number) {
    activeSessionForTransfer = { sessionId, stationId, stationName, gamingCost, ordersCost };
    transferTargetSessionId = null;
    transferIncludeOrders = true;
    showTransferModal = true;
  }

  function closeTransferModal() {
    showTransferModal = false;
    activeSessionForTransfer = null;
    transferTargetSessionId = null;
    transferIncludeOrders = true;
  }

  // Get other active sessions (for transfer target selection)
  function getOtherActiveSessions(excludeSessionId: AnyId) {
    return data.activeSessions?.filter(s => s.id !== excludeSessionId) || [];
  }

  // Open switch station modal
  function openSwitchStationModal(sessionId: AnyId, currentStationId: string, stationName: string) {
    activeSessionForSwitch = { sessionId, currentStationId, stationName };
    switchTargetStationId = null;
    showSwitchStationModal = true;
  }

  function closeSwitchStationModal() {
    showSwitchStationModal = false;
    activeSessionForSwitch = null;
    switchTargetStationId = null;
  }

  // Get available stations (not occupied, not maintenance, not current)
  function getAvailableStations(excludeStationId: string) {
    if (!stationStatuses) return [];
    return (stationStatuses as any[])
      .filter(s => (s.station._id ?? s.station.id) !== excludeStationId &&
                   s.station.status === 'available' &&
                   !s.activeSession)
      .map(s => s.station);
  }

  // Switch session mode
  async function switchSessionMode(sessionId: AnyId, newMode: 'single' | 'multi') {
    try {
      const formData = new FormData();
      formData.append('sessionId', sessionId.toString());
      formData.append('mode', newMode);

      const response = await fetch('?/switchMode', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.type === 'success') {
        toast.success(newMode === 'multi' ? 'تم التحويل لوضع متعدد اللاعبين' : 'تم التحويل لوضع فردي');
        await invalidateAll();
      } else {
        toast.error('فشل في تغيير الوضع');
      }
    } catch (err) {
      toast.error('فشل في تغيير الوضع');
    }
  }

  // Duration options (time limit)
  const durationOptions = [
    { value: null, label: 'مفتوح', description: 'بدون حد زمني' },
    { value: 30, label: '30 دقيقة', description: 'نصف ساعة' },
    { value: 60, label: 'ساعة', description: '60 دقيقة' },
    { value: 90, label: '90 دقيقة', description: 'ساعة ونصف' },
    { value: 120, label: 'ساعتين', description: '120 دقيقة' },
    { value: 150, label: '2.5 ساعة', description: '150 دقيقة' },
    { value: 180, label: '3 ساعات', description: '180 دقيقة' },
  ];

  // Cost limit options (in EGP)
  const costLimitOptions = [
    { value: null, label: 'بدون حد', description: 'مفتوح' },
    { value: 5, label: '5 ج.م', description: 'حد السعر' },
    { value: 10, label: '10 ج.م', description: 'حد السعر' },
    { value: 15, label: '15 ج.م', description: 'حد السعر' },
    { value: 20, label: '20 ج.م', description: 'حد السعر' },
    { value: 30, label: '30 ج.م', description: 'حد السعر' },
  ];
</script>

<div class="playstation-page">
  <!-- Page Header -->
  <header class="page-header opacity-0 animate-fade-in">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="page-title">
          <Gamepad2 class="w-7 h-7 inline-block ml-2 text-primary-light" />
          البلايستيشن
        </h1>
        <p class="page-subtitle">إدارة أجهزة الألعاب</p>
      </div>
      <div class="flex items-center gap-3">
        <!-- Sound Toggle -->
        <button
          class="sound-toggle-btn"
          class:active={soundEnabled}
          onclick={toggleSound}
          title={soundEnabled ? 'صوت التنبيه مفعل - اضغط للإيقاف' : 'صوت التنبيه متوقف - اضغط للتفعيل'}
        >
          <Volume2 class="w-4 h-4" />
          {#if !soundEnabled}
            <span class="sound-off-line"></span>
          {/if}
        </button>

        <div class="hidden md:flex items-center gap-2 text-sm text-text-secondary">
          <Activity class="w-4 h-4" />
          <span>{isConvexReady ? 'متصل مباشرة' : 'جاري الاتصال...'}</span>
        </div>
        <button
          onclick={syncRouterRules}
          disabled={isSyncing}
          class="sync-btn"
          title="مزامنة قواعد الراوتر"
        >
          <RefreshCw class="w-5 h-5 {isSyncing ? 'animate-spin' : ''}" />
        </button>
        <a href="/playstation/menu" class="menu-btn" title="قائمة الطعام والمشروبات">
          <Coffee class="w-5 h-5" />
        </a>
        <a href="/playstation/settings" class="settings-btn" title="إعدادات الأجهزة">
          <Settings class="w-5 h-5" />
        </a>
      </div>
    </div>
  </header>

  <!-- Timer Alerts -->
  {#if data.timerAlerts && data.timerAlerts.length > 0}
    <div class="alerts-section opacity-0 animate-fade-in" style="animation-delay: 50ms">
      {#each data.timerAlerts as alert}
        <div class="timer-alert glass-card">
          <div class="alert-icon">
            <Bell class="w-5 h-5" />
          </div>
          <div class="alert-content">
            <span class="alert-title">انتهى الوقت المحدد!</span>
            <span class="alert-station">{alert.stationName} - {alert.timerMinutes} دقيقة</span>
          </div>
          <form
            method="POST"
            action="?/dismissAlert"
            use:enhance={() => {
              return async ({ result }) => {
                if (result.type === 'success') {
                  await invalidateAll();
                }
              };
            }}
          >
            <input type="hidden" name="sessionId" value={alert.sessionId} />
            <button type="submit" class="alert-dismiss" title="إغلاق">
              <X class="w-4 h-4" />
            </button>
          </form>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Loading Skeleton -->
  {#if browser && !isConvexReady}
    <div class="stats-grid opacity-0 animate-fade-in" style="animation-delay: 100ms">
      {#each [1, 2, 3] as _}
        <div class="stat-card glass-card">
          <div class="stat-header">
            <div class="skeleton skeleton-text" style="width: 80px"></div>
            <div class="skeleton skeleton-icon"></div>
          </div>
          <div class="skeleton skeleton-value" style="width: 60px; margin-top: 8px"></div>
          <div class="stat-footer">
            <div class="skeleton skeleton-text" style="width: 50px"></div>
          </div>
        </div>
      {/each}
    </div>

    <section class="stations-section opacity-0 animate-fade-in" style="animation-delay: 200ms">
      <div class="section-header">
        <h2 class="section-title">الأجهزة</h2>
      </div>
      <div class="stations-grid">
        {#each [1, 2, 3, 4] as _, index}
          <div class="station-card glass-card opacity-0 animate-fade-in" style="animation-delay: {300 + index * 50}ms">
            <div class="station-header">
              <div class="station-info">
                <div class="skeleton skeleton-text" style="width: 70px; height: 20px"></div>
                <div class="skeleton skeleton-text" style="width: 50px; height: 14px; margin-top: 4px"></div>
              </div>
              <div class="skeleton skeleton-badge" style="width: 60px; height: 24px; border-radius: 12px"></div>
            </div>
            <div class="skeleton-station-body">
              <div class="skeleton skeleton-block" style="height: 80px; margin-top: 12px; border-radius: 12px"></div>
              <div class="skeleton skeleton-block" style="height: 40px; margin-top: 12px; border-radius: 8px"></div>
              <div class="skeleton skeleton-block" style="height: 40px; margin-top: 8px; border-radius: 8px"></div>
            </div>
          </div>
        {/each}
      </div>
    </section>
  {:else}
  <!-- Stats Overview -->
  <div class="stats-grid opacity-0 animate-fade-in" style="animation-delay: 100ms">
    <div class="stat-card glass-card">
      <div class="stat-header">
        <span class="stat-title">إجمالي الجلسات</span>
        <div class="stat-icon-wrapper stat-icon-primary">
          <Timer class="w-5 h-5" />
        </div>
      </div>
      <div class="stat-value">{analytics?.totalSessions ?? 0}</div>
      <div class="stat-footer">
        <span class="stat-subtitle">اليوم</span>
        <TrendingUp class="w-4 h-4 text-success" />
      </div>
    </div>

    <div class="stat-card glass-card">
      <div class="stat-header">
        <span class="stat-title">إيراد اليوم</span>
        <div class="stat-icon-wrapper stat-icon-success">
          <Banknote class="w-5 h-5" />
        </div>
      </div>
      <div class="stat-value">{formatRevenue(analytics?.totalRevenue ?? 0)} ج.م</div>
      <div class="stat-footer">
        <span class="stat-subtitle">{analytics?.totalMinutes ?? 0} دقيقة</span>
        <TrendingUp class="w-4 h-4 text-success" />
      </div>
    </div>

    <div class="stat-card glass-card">
      <div class="stat-header">
        <span class="stat-title">الأجهزة</span>
        <div class="stat-icon-wrapper stat-icon-warning">
          <Gamepad2 class="w-5 h-5" />
        </div>
      </div>
      <div class="stat-value">
        <span class="text-success">{occupiedCount}</span>
        <span class="text-text-muted mx-1">/</span>
        <span>{stationStatuses?.length ?? 0}</span>
      </div>
      <div class="stat-footer">
        <span class="stat-subtitle">{availableCount} متاح</span>
        {#if maintenanceCount > 0}
          <span class="badge badge-warning">{maintenanceCount} صيانة</span>
        {/if}
      </div>
    </div>
  </div>

  <!-- Stations Grid -->
  {#if stationStatuses && stationStatuses.length > 0}
    <section class="stations-section opacity-0 animate-fade-in" style="animation-delay: 200ms">
      <div class="section-header">
        <h2 class="section-title">الأجهزة</h2>
        <a href="/playstation/history" class="view-all-link">
          <History class="w-4 h-4" />
          سجل الجلسات
        </a>
      </div>

      <div class="stations-grid">
        {#each stationStatuses as status, index (status.station.id)}
          {@const statusColor = getStatusColor(status.station.status, status.isOnline, status.isOfflineWithSession)}
          {@const isMultiMode = status.activeSession?.currentMode === 'multi'}
          <div
            class="station-card glass-card station-{statusColor} opacity-0 animate-fade-in"
            class:multi-mode={isMultiMode}
            style="animation-delay: {300 + index * 50}ms"
          >
            <!-- Station Header -->
            <div class="station-header">
              <div class="station-info">
                <h3 class="station-name">{status.station.nameAr}</h3>
                <span class="station-id">{status.station.name}</span>
              </div>
              <div class="station-status">
                <span class="status-badge status-{statusColor}">
                  {getStatusText(status.station.status, status.isOnline, status.isOfflineWithSession)}
                </span>
                <div class="online-indicator" class:online={status.isOnline}>
                  {#if status.isOnline}
                    <Wifi class="w-4 h-4" />
                  {:else}
                    <WifiOff class="w-4 h-4" />
                  {/if}
                </div>
                <button
                  class="internet-toggle" class:active={status.station.hasInternet}
                  onclick={() => toggleInternet(status.station.id, !!status.station.hasInternet)}
                  disabled={internetToggleLoading === status.station.id}
                  title={status.station.hasInternet ? 'إيقاف الإنترنت' : 'تفعيل الإنترنت'}
                >
                  {#if internetToggleLoading === status.station.id}
                    <span class="loading-spinner-sm"></span>
                  {:else}
                    <Globe class="w-3.5 h-3.5" />
                  {/if}
                  <span class="internet-label">{status.station.hasInternet ? 'متصل' : 'مقطوع'}</span>
                </button>
              </div>
            </div>
            <div class="station-net-info">{status.station.macAddress} · 192.168.1.{230 + (parseInt(status.station.name.replace(/\D/g, '')) || 0)}</div>

            <!-- Monitor Controls (if monitor configured) -->
            {#if status.station.monitorIp}
              <div class="monitor-controls">
                <button
                  class="monitor-btn monitor-btn-on"
                  onclick={() => controlMonitor(status.station.id, 'screen_on')}
                  disabled={monitorControlLoading === status.station.id}
                  title="Wake screen"
                >
                  {#if monitorControlLoading === status.station.id}
                    <span class="loading-spinner-sm"></span>
                  {:else}
                    <Monitor class="w-3.5 h-3.5" />
                  {/if}
                </button>
                <button
                  class="monitor-btn monitor-btn-off"
                  onclick={() => controlMonitor(status.station.id, 'screen_off')}
                  disabled={monitorControlLoading === status.station.id}
                  title="Sleep screen"
                >
                  <MonitorOff class="w-3.5 h-3.5" />
                </button>
                <button
                  class="monitor-btn monitor-btn-hdmi"
                  onclick={() => controlMonitor(status.station.id, 'hdmi_switch')}
                  disabled={monitorControlLoading === status.station.id}
                  title="Switch HDMI to PS"
                >
                  <Tv class="w-3.5 h-3.5" />
                </button>
              </div>
            {/if}

            <!-- Session Info -->
            {#if status.activeSession}
              {@const timerInfo = getTimerRemaining(status.activeSession)}
              {@const ordersTotal = status.orders ? getOrdersTotal(status.orders) : 0}
              {@const chargesTotal = status.activeSession.extraCharges || 0}
              {@const transferredTotal = status.activeSession.transferredCost || 0}
              {@const currentMode = status.activeSession.currentMode || 'single'}
              {@const hasMultiRate = status.station.hourlyRateMulti != null}

              <!-- Big PS Number/Name Card -->
              <div class="ps-big-card">
                <div class="ps-big-number">{status.station.name}</div>
                <div class="ps-big-name">{status.station.nameAr}</div>
              </div>

              <!-- Mode Toggle (only if multi rate is configured) -->
              {#if hasMultiRate}
                <div class="mode-toggle-row">
                  <button
                    class="mode-btn"
                    class:active={currentMode === 'single'}
                    onclick={() => switchSessionMode(status.activeSession!.id, 'single')}
                  >
                    <User class="w-4 h-4" />
                    فردي
                  </button>
                  <button
                    class="mode-btn"
                    class:active={currentMode === 'multi'}
                    onclick={() => switchSessionMode(status.activeSession!.id, 'multi')}
                  >
                    <Users class="w-4 h-4" />
                    متعدد
                  </button>
                </div>
              {/if}

              <!-- Session Start Time - BIGGER -->
              <div class="session-start-time">
                <Clock class="w-5 h-5" />
                <span class="start-time-value">{formatTime(status.activeSession.startedAt)}</span>
                <button
                  class="edit-time-btn"
                  title="تعديل وقت البداية"
                  onclick={() => openEditStartTimeModal(status.activeSession!.id, status.activeSession!.startedAt)}
                >
                  <Pencil class="w-3 h-3" />
                </button>
                <button
                  class="set-timer-btn"
                  class:has-timer={timerInfo}
                  class:expired={timerInfo?.isExpired}
                  onclick={() => openTimerModal(status.activeSession!.id, status.activeSession!.timerMinutes ?? null, status.activeSession!.costLimitPiasters ?? null)}
                >
                  <Timer class="w-4 h-4" />
                  {#if timerInfo}
                    {timerInfo.text}
                  {:else}
                    مؤقت
                  {/if}
                </button>
              </div>

              {@const gamingCost = status.costBreakdown ? status.costBreakdown.total / 100 : parseFloat(calculateCost(status.activeSession, status.activeSession.hourlyRateSnapshot))}
              {@const totalCost = gamingCost + (ordersTotal / 100) + (chargesTotal / 100) + (transferredTotal / 100)}

              <div class="session-info">
                <div class="timer-display" class:paused={status.isPaused}>
                  <Clock class="w-5 h-5" />
                  <span class="timer-value">{formatElapsed(status.activeSession)}{status.isPaused ? ' ⏸' : ''}</span>
                </div>
                <div class="cost-display">
                  <Banknote class="w-5 h-5" />
                  <span class="cost-value">{gamingCost.toFixed(1)} ج.م</span>
                </div>
              </div>

              <!-- Orders Summary -->
              <div class="orders-section">
                <div class="orders-header-row">
                  <span class="orders-label">
                    <UtensilsCrossed class="w-4 h-4" />
                    الطلبات
                    {#if status.orders && status.orders.length > 0}
                      <span class="orders-count">({status.orders.length})</span>
                    {/if}
                  </span>
                  <button class="add-order-btn" onclick={() => openOrderModal(status.station.id, status.activeSession!.id)}>
                    <Plus class="w-4 h-4" />
                    إضافة
                  </button>
                </div>
                {#if status.orders && status.orders.length > 0}
                  <div class="orders-list-compact">
                    {#each status.orders as order}
                      <div class="order-row">
                        <span class="order-details">{order.menuItem?.nameAr || 'عنصر محذوف'} × {order.quantity}</span>
                        <div class="order-row-end">
                          <span class="order-cost">{formatRevenue(order.priceSnapshot * order.quantity)} ج.م</span>
                          <button
                            class="remove-order-btn"
                            onclick={() => removeOrder(order.id)}
                            title="حذف الطلب"
                          >
                            <X class="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    {/each}
                    <div class="orders-total-row">
                      <span>الإجمالي</span>
                      <span class="total-value">{formatRevenue(ordersTotal)} ج.م</span>
                    </div>
                  </div>
                {:else}
                  <p class="no-orders">لا توجد طلبات</p>
                {/if}

              <!-- Extra Charges Section -->
              <div class="charges-section">
                <div class="orders-header-row">
                  <span class="orders-label">
                    <DollarSign class="w-4 h-4" />
                    رسوم إضافية
                    {#if status.charges && status.charges.length > 0}
                      <span class="orders-count">({status.charges.length})</span>
                    {/if}
                  </span>
                  <button class="add-order-btn" onclick={() => openChargeModal(status.activeSession!.id, status.station.nameAr)}>
                    <Plus class="w-4 h-4" />
                    إضافة
                  </button>
                </div>
                {#if status.charges && status.charges.length > 0}
                  <div class="orders-list-compact">
                    {#each status.charges as charge}
                      <div class="order-row">
                        <span class="order-details">{charge.reason || 'رسوم إضافية'}</span>
                        <div class="order-row-end">
                          <span class="order-cost">{formatRevenue(charge.amount)} ج.م</span>
                          <button
                            class="edit-order-btn"
                            onclick={() => openChargeModal(status.activeSession!.id, status.station.nameAr, { id: charge.id, amount: charge.amount, reason: charge.reason ?? null })}
                            title="تعديل"
                          >
                            <Pencil class="w-3 h-3" />
                          </button>
                          <button
                            class="remove-order-btn"
                            onclick={() => deleteChargeHandler(charge.id)}
                            title="حذف"
                          >
                            <X class="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    {/each}
                    <div class="orders-total-row">
                      <span>الإجمالي</span>
                      <span class="total-value">{formatRevenue(chargesTotal)} ج.م</span>
                    </div>
                  </div>
                {:else}
                  <p class="no-orders">لا توجد رسوم</p>
                {/if}
              </div>

              <!-- Incoming Transfers Section -->
              {#if status.transfers && status.transfers.length > 0}
                <div class="transfers-section">
                  <div class="orders-header-row">
                    <span class="orders-label">
                      <ArrowRightLeft class="w-4 h-4" />
                      تحويلات واردة
                    </span>
                  </div>
                  <div class="orders-list-compact">
                    {#each status.transfers as transfer}
                      <div class="order-row transfer-row">
                        <span class="order-details">من {transfer.fromStationId}</span>
                        <span class="order-cost">{formatRevenue(transfer.totalAmount)} ج.م</span>
                      </div>
                    {/each}
                    <div class="orders-total-row">
                      <span>الإجمالي</span>
                      <span class="total-value">{formatRevenue(transferredTotal)} ج.م</span>
                    </div>
                  </div>
                </div>
              {/if}
              </div>

              <!-- Total Cost (Gaming + Orders + Charges + Transfers) - at bottom -->
              <div class="total-cost-display total-at-bottom">
                <span class="total-label">الإجمالي الكلي</span>
                <span class="total-amount">{totalCost.toFixed(1)} ج.م</span>
              </div>

              {#if status.isOfflineWithSession}
                <div class="offline-warning">
                  <AlertTriangle class="w-4 h-4" />
                  <span>الجهاز غير متصل - يرجى إنهاء الجلسة يدوياً</span>
                </div>
              {/if}
            {:else}
              <!-- Last Session Info (show cost after session ends) -->
              {#if status.lastSession}
                {@const lastGamingCost = status.lastSession.totalCost || 0}
                {@const lastTotalCost = lastGamingCost + (status.lastSession.ordersCost || 0)}
                {@const sessionEndedRecently = (Date.now() - (status.lastSession.endedAt || 0)) < 30 * 60 * 1000}

                {#if sessionEndedRecently}
                  <div class="last-session-summary">
                    <div class="last-session-header">
                      <span class="last-session-label">آخر جلسة</span>
                      <span class="last-session-time">{formatTime(status.lastSession.endedAt || 0)}</span>
                    </div>
                    <div class="last-session-details">
                      <div class="last-session-breakdown">
                        <span>وقت اللعب:</span>
                        <span>{formatRevenue(lastGamingCost)} ج.م</span>
                      </div>
                      {#if status.lastSession.ordersCost && status.lastSession.ordersCost > 0}
                        <div class="last-session-breakdown">
                          <span>طلبات:</span>
                          <span>{formatRevenue(status.lastSession.ordersCost)} ج.م</span>
                        </div>
                      {/if}
                      <div class="last-session-total">
                        <span>الإجمالي:</span>
                        <span class="total-value">{formatRevenue(lastTotalCost)} ج.م</span>
                      </div>
                    </div>
                  </div>
                {/if}
              {/if}

              <div class="rate-info">
                <span class="rate-label">السعر:</span>
                <span class="rate-value">{formatRate(status.station.hourlyRate)} ج.م/ساعة</span>
              </div>
            {/if}

            <!-- Actions -->
            <div class="station-actions">
              {#if status.station.status === 'maintenance'}
                <span class="maintenance-notice">الجهاز في الصيانة</span>
              {:else if status.activeSession}
                {@const gamingCostForEnd = status.costBreakdown ? status.costBreakdown.total : parseFloat(calculateCost(status.activeSession, status.activeSession.hourlyRateSnapshot)) * 100}
                {@const ordersTotalForEnd = status.orders ? getOrdersTotal(status.orders) : 0}
                {@const extraChargesForEnd = status.activeSession.extraCharges || 0}
                {@const transferredForEnd = status.activeSession.transferredCost || 0}
                <button
                  class="btn btn-secondary btn-station-small"
                  onclick={() => openSwitchStationModal(
                    status.activeSession!.id,
                    status.station.id,
                    status.station.nameAr
                  )}
                >
                  <Repeat class="w-4 h-4" />
                  نقل
                </button>
                <button
                  class="btn btn-danger btn-station"
                  onclick={() => openEndSessionModal(
                    status.activeSession!.id,
                    status.station.nameAr,
                    gamingCostForEnd,
                    ordersTotalForEnd,
                    extraChargesForEnd,
                    transferredForEnd,
                    status.costBreakdown?.breakdown || null
                  )}
                >
                  <Square class="w-4 h-4" />
                  إنهاء الجلسة
                </button>
              {:else}
                <button class="btn btn-success btn-station" onclick={() => openDurationModal(status.station.id)}>
                  <Play class="w-4 h-4" />
                  بدء جلسة
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </section>
  {:else}
    <!-- Empty State -->
    <div class="empty-state glass-card opacity-0 animate-fade-in" style="animation-delay: 200ms">
      <Gamepad2 class="empty-state-icon" />
      <h3>لا توجد أجهزة مسجلة</h3>
      <p>أضف أجهزة PlayStation من صفحة الإعدادات</p>
      <a href="/playstation/settings" class="btn btn-primary mt-4">
        <Settings class="w-4 h-4" />
        إضافة جهاز
      </a>
    </div>
  {/if}
  {/if}
</div>

<!-- Duration Selection Modal (for starting session) -->
{#if showDurationModal && activeStationForStart}
  <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
  <div class="modal-overlay" onclick={closeDurationModal}>
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div class="modal-box modal-lg modal-rtl" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <button class="modal-close" onclick={closeDurationModal}>
          <X class="w-5 h-5" />
        </button>
        <h3>إعدادات الجلسة</h3>
      </div>
      <div class="modal-body">
        <!-- Time Limit Section -->
        <div class="limit-section">
          <h4 class="limit-section-title">
            <Timer class="w-4 h-4" />
            حد الوقت
          </h4>
          <div class="duration-grid">
            {#each durationOptions as option}
              <button
                class="duration-option"
                class:selected={selectedDuration === option.value}
                onclick={() => selectedDuration = option.value}
              >
                <span class="duration-label">{option.label}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Cost Limit Section -->
        <div class="limit-section">
          <h4 class="limit-section-title">
            <Banknote class="w-4 h-4" />
            حد السعر
          </h4>
          <div class="duration-grid">
            {#each costLimitOptions as option}
              <button
                class="duration-option"
                class:selected={selectedCostLimit === option.value}
                onclick={() => selectedCostLimit = option.value}
              >
                <span class="duration-label">{option.label}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Custom Start Time Section -->
        <div class="limit-section">
          <h4 class="limit-section-title">
            <Clock class="w-4 h-4" />
            وقت بداية مخصص (اليوم)
          </h4>
          <div class="time-picker-row">
            <input
              type="time"
              class="input-modern time-input"
              bind:value={customStartTimeHour}
            />
            {#if customStartTimeHour}
              <button type="button" class="clear-time-btn" onclick={() => customStartTimeHour = ''}>
                <X class="w-4 h-4" />
              </button>
            {/if}
          </div>
          <p class="limit-hint">اتركه فارغاً للبدء من الآن</p>
        </div>
      </div>
      <div class="modal-footer-rtl">
        <form
          method="POST"
          action="?/startSession"
          use:enhance={() => {
            return async ({ result }) => {
              if (result.type === 'success') {
                toast.success('تم بدء الجلسة');
                closeDurationModal();
                await invalidateAll();
              } else if (result.type === 'failure') {
                toast.error(String(result.data?.error || 'فشل في بدء الجلسة'));
              } else {
                toast.error('فشل في بدء الجلسة');
              }
            };
          }}
        >
          <input type="hidden" name="stationId" value={activeStationForStart} />
          <input type="hidden" name="timerMinutes" value={selectedDuration || ''} />
          <input type="hidden" name="costLimit" value={selectedCostLimit || ''} />
          <input type="hidden" name="customStartTime" value={customStartTimeHour ? timeToTodayTimestamp(customStartTimeHour) : ''} />
          <button type="submit" class="btn btn-primary">
            <Play class="w-4 h-4" />
            بدء الجلسة
          </button>
        </form>
        <button class="btn btn-ghost" onclick={closeDurationModal}>إلغاء</button>
      </div>
    </div>
  </div>
{/if}

<!-- Add Order Modal -->
{#if showOrderModal && activeStationForOrder}
  <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
  <div class="modal-overlay" onclick={closeOrderModal}>
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div class="modal-box modal-lg modal-rtl" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <button class="modal-close" onclick={closeOrderModal}>
          <X class="w-5 h-5" />
        </button>
        <h3>إضافة طلبات</h3>
      </div>
      <div class="modal-body">
        <!-- Category Tabs -->
        <div class="menu-categories">
          {#if menuByCategory.drinks.length > 0}
            <div class="category-section">
              <h4 class="category-title">
                <Coffee class="w-4 h-4" />
                مشروبات
              </h4>
              <div class="menu-grid">
                {#each menuByCategory.drinks as item}
                  {@const qty = orderCart.get(item.id) || 0}
                  <div class="menu-item-card" class:in-cart={qty > 0}>
                    <div class="item-info">
                      <span class="item-name">{item.nameAr}</span>
                      <span class="item-price">{formatRevenue(item.price)} ج.م</span>
                    </div>
                    <div class="item-controls">
                      {#if qty > 0}
                        <button class="qty-btn-sm" onclick={() => removeFromCart(item.id)}>
                          <Minus class="w-4 h-4" />
                        </button>
                        <span class="qty-badge">{qty}</span>
                      {/if}
                      <button class="qty-btn-sm add" onclick={() => addToCart(item.id)}>
                        <Plus class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
          {#if menuByCategory.food.length > 0}
            <div class="category-section">
              <h4 class="category-title">
                <UtensilsCrossed class="w-4 h-4" />
                طعام
              </h4>
              <div class="menu-grid">
                {#each menuByCategory.food as item}
                  {@const qty = orderCart.get(item.id) || 0}
                  <div class="menu-item-card" class:in-cart={qty > 0}>
                    <div class="item-info">
                      <span class="item-name">{item.nameAr}</span>
                      <span class="item-price">{formatRevenue(item.price)} ج.م</span>
                    </div>
                    <div class="item-controls">
                      {#if qty > 0}
                        <button class="qty-btn-sm" onclick={() => removeFromCart(item.id)}>
                          <Minus class="w-4 h-4" />
                        </button>
                        <span class="qty-badge">{qty}</span>
                      {/if}
                      <button class="qty-btn-sm add" onclick={() => addToCart(item.id)}>
                        <Plus class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
          {#if menuByCategory.snacks.length > 0}
            <div class="category-section">
              <h4 class="category-title">سناكس</h4>
              <div class="menu-grid">
                {#each menuByCategory.snacks as item}
                  {@const qty = orderCart.get(item.id) || 0}
                  <div class="menu-item-card" class:in-cart={qty > 0}>
                    <div class="item-info">
                      <span class="item-name">{item.nameAr}</span>
                      <span class="item-price">{formatRevenue(item.price)} ج.م</span>
                    </div>
                    <div class="item-controls">
                      {#if qty > 0}
                        <button class="qty-btn-sm" onclick={() => removeFromCart(item.id)}>
                          <Minus class="w-4 h-4" />
                        </button>
                        <span class="qty-badge">{qty}</span>
                      {/if}
                      <button class="qty-btn-sm add" onclick={() => addToCart(item.id)}>
                        <Plus class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <!-- Cart Summary -->
        {#if orderCart.size > 0}
          <div class="cart-summary">
            <div class="cart-header">
              <span class="cart-title">سلة الطلبات ({getCartCount()})</span>
              <span class="cart-total">{formatRevenue(getCartTotal())} ج.م</span>
            </div>
            <div class="cart-items">
              {#each Array.from(orderCart.entries()) as [itemId, qty]}
                {@const item = menuItems?.find(m => m.id === itemId)}
                {#if item}
                  <div class="cart-item">
                    <span class="cart-item-name">{item.nameAr} × {qty}</span>
                    <span class="cart-item-price">{formatRevenue(item.price * qty)} ج.م</span>
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        {/if}
      </div>
      <div class="modal-footer-rtl">
        <form
          method="POST"
          action="?/addMultipleOrders"
          use:enhance={() => {
            return async ({ result }) => {
              if (result.type === 'success') {
                toast.success('تمت إضافة الطلبات');
                closeOrderModal();
                await invalidateAll();
              } else if (result.type === 'failure') {
                toast.error(String(result.data?.error || 'فشل في إضافة الطلبات'));
              } else {
                toast.error('فشل في إضافة الطلبات');
              }
            };
          }}
        >
          <input type="hidden" name="sessionId" value={activeStationForOrder.sessionId} />
          <input type="hidden" name="items" value={JSON.stringify(Array.from(orderCart.entries()).map(([id, qty]) => ({ menuItemId: id, quantity: qty })))} />
          <button type="submit" class="btn btn-primary" disabled={orderCart.size === 0}>
            <Plus class="w-4 h-4" />
            إضافة ({getCartCount()}) طلبات
          </button>
        </form>
        <button class="btn btn-ghost" onclick={closeOrderModal}>إلغاء</button>
      </div>
    </div>
  </div>
{/if}

<!-- Set Timer Modal (for active sessions) -->
{#if showTimerModal && activeSessionForTimer}
  <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
  <div class="modal-overlay" onclick={closeTimerModal}>
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div class="modal-box modal-rtl" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <button class="modal-close" onclick={closeTimerModal}>
          <X class="w-5 h-5" />
        </button>
        <h3>إعدادات المؤقت</h3>
      </div>
      <div class="modal-body">
        <div class="limit-section">
          <h4 class="limit-section-title">حد الوقت</h4>
          <div class="duration-grid">
            {#each durationOptions as option}
              <button
                class="duration-option"
                class:selected={selectedDuration === option.value}
                onclick={() => selectedDuration = option.value}
              >
                <span class="duration-label">{option.label}</span>
                <span class="duration-desc">{option.description}</span>
              </button>
            {/each}
          </div>
        </div>
        <div class="limit-section">
          <h4 class="limit-section-title">حد السعر</h4>
          <div class="duration-grid">
            {#each costLimitOptions as option}
              <button
                class="duration-option"
                class:selected={selectedCostLimit === option.value}
                onclick={() => selectedCostLimit = option.value}
              >
                <span class="duration-label">{option.label}</span>
                <span class="duration-desc">{option.description}</span>
              </button>
            {/each}
          </div>
        </div>
      </div>
      <div class="modal-footer-rtl">
        <form
          method="POST"
          action="?/setTimer"
          use:enhance={() => {
            return async ({ result }) => {
              if (result.type === 'success') {
                toast.success('تم تحديث المؤقت');
                closeTimerModal();
                await invalidateAll();
              } else if (result.type === 'failure') {
                toast.error(String(result.data?.error || 'فشل في تحديث المؤقت'));
              } else {
                toast.error('فشل في تحديث المؤقت');
              }
            };
          }}
        >
          <input type="hidden" name="sessionId" value={activeSessionForTimer} />
          <input type="hidden" name="timerMinutes" value={selectedDuration || ''} />
          <input type="hidden" name="costLimit" value={selectedCostLimit || ''} />
          <button type="submit" class="btn btn-primary">
            <Timer class="w-4 h-4" />
            حفظ
          </button>
        </form>
        <button class="btn btn-ghost" onclick={closeTimerModal}>إلغاء</button>
      </div>
    </div>
  </div>
{/if}

<!-- End Session Modal -->
{#if showEndSessionModal && activeSessionForEnd}
  {@const totalCostRaw = activeSessionForEnd.calculatedCost + activeSessionForEnd.ordersTotal + activeSessionForEnd.extraCharges + activeSessionForEnd.transferredCost}
  {@const roundedCost = roundToNearest(totalCostRaw, 500)}
  {@const finalCost = getFinalCost()}
  {@const hasOtherSessions = data.activeSessions && data.activeSessions.filter(s => s.id !== activeSessionForEnd!.sessionId).length > 0}

  <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
  <div class="modal-overlay" onclick={closeEndSessionModal}>
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div class="modal-box modal-lg modal-rtl" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <button class="modal-close" onclick={closeEndSessionModal}>
          <X class="w-5 h-5" />
        </button>
        <h3>إنهاء جلسة - {activeSessionForEnd.stationName}</h3>
      </div>
      <div class="modal-body">
        <!-- Cost Summary with Mode Breakdown -->
        <div class="end-session-summary">
          {#if activeSessionForEnd.costBreakdown && activeSessionForEnd.costBreakdown.length > 1}
            <!-- Show breakdown by mode -->
            {#each activeSessionForEnd.costBreakdown as segment}
              <div class="cost-row segment-row">
                <span>
                  {segment.mode === 'single' ? 'فردي' : 'متعدد'}
                  ({segment.minutes} دقيقة):
                </span>
                <span>{formatRevenue(segment.cost)} ج.م</span>
              </div>
            {/each}
            <div class="cost-row subtotal-row">
              <span>إجمالي اللعب:</span>
              <span>{formatRevenue(activeSessionForEnd.calculatedCost)} ج.م</span>
            </div>
          {:else}
            <div class="cost-row">
              <span>تكلفة اللعب:</span>
              <span>{formatRevenue(activeSessionForEnd.calculatedCost)} ج.م</span>
            </div>
          {/if}
          {#if activeSessionForEnd.ordersTotal > 0}
            <div class="cost-row">
              <span>الطلبات:</span>
              <span>{formatRevenue(activeSessionForEnd.ordersTotal)} ج.م</span>
            </div>
          {/if}
          {#if activeSessionForEnd.extraCharges > 0}
            <div class="cost-row">
              <span>رسوم إضافية:</span>
              <span>{formatRevenue(activeSessionForEnd.extraCharges)} ج.م</span>
            </div>
          {/if}
          {#if activeSessionForEnd.transferredCost > 0}
            <div class="cost-row transfer-row-highlight">
              <span>تحويلات واردة:</span>
              <span>{formatRevenue(activeSessionForEnd.transferredCost)} ج.م</span>
            </div>
          {/if}
          <div class="cost-row total-row">
            <span>الإجمالي الحقيقي:</span>
            <span>{formatRevenue(totalCostRaw)} ج.م</span>
          </div>
        </div>

        <!-- Transfer Option -->
        {#if hasOtherSessions}
          <div class="transfer-option-section">
            <button
              class="transfer-option-btn"
              onclick={() => {
                // Capture values before closing modal
                const sessionId = activeSessionForEnd!.sessionId;
                const stationName = activeSessionForEnd!.stationName;
                const gamingCost = activeSessionForEnd!.calculatedCost;
                const ordersCost = activeSessionForEnd!.ordersTotal;
                closeEndSessionModal();
                openTransferModal(sessionId, '', stationName, gamingCost, ordersCost);
              }}
            >
              <ArrowRightLeft class="w-5 h-5" />
              <div class="transfer-option-text">
                <span class="transfer-option-title">تحويل لجهاز آخر</span>
                <span class="transfer-option-desc">نقل التكلفة إلى جلسة أخرى نشطة</span>
              </div>
            </button>
          </div>
        {/if}

        <!-- Cost Options -->
        <div class="cost-options">
          <h4>اختر المبلغ النهائي</h4>

          <!-- Rounded Option -->
          <button
            class="cost-option"
            class:selected={endSessionMode === 'rounded'}
            onclick={() => { endSessionMode = 'rounded'; customAmount = ''; }}
          >
            <div class="option-label">
              <span class="option-title">تقريب</span>
              <span class="option-desc">تقريب لأقرب 5 ج.م</span>
            </div>
            <span class="option-value">{formatRevenue(roundedCost)} ج.م</span>
          </button>

          <!-- Zero Option -->
          <button
            class="cost-option"
            class:selected={endSessionMode === 'zero'}
            onclick={() => { endSessionMode = 'zero'; customAmount = ''; }}
          >
            <div class="option-label">
              <span class="option-title">مجاناً</span>
              <span class="option-desc">إنهاء بدون تكلفة</span>
            </div>
            <span class="option-value zero">0 ج.م</span>
          </button>

          <!-- Custom Option -->
          <button
            class="cost-option"
            class:selected={endSessionMode === 'custom'}
            onclick={() => endSessionMode = 'custom'}
          >
            <div class="option-label">
              <span class="option-title">مبلغ مخصص</span>
              <span class="option-desc">أدخل المبلغ يدوياً</span>
            </div>
            {#if endSessionMode === 'custom'}
              <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
              <div class="custom-input-wrapper" onclick={(e) => e.stopPropagation()}>
                <input
                  type="number"
                  class="custom-amount-input"
                  placeholder="0"
                  bind:value={customAmount}
                  min="0"
                  step="0.5"
                />
                <span class="input-suffix">ج.م</span>
              </div>
            {:else}
              <span class="option-value custom">...</span>
            {/if}
          </button>
        </div>

        <!-- Final Amount Display -->
        <div class="final-amount-display">
          <span class="final-label">المبلغ النهائي:</span>
          <span class="final-value" class:zero={endSessionMode === 'zero' || finalCost === 0}>
            {formatRevenue(finalCost)} ج.م
          </span>
        </div>
      </div>
      <div class="modal-footer-rtl">
        {#if endSessionMode === 'zero'}
          <button
            class="btn btn-danger"
            onclick={() => showZeroConfirmModal = true}
          >
            <Square class="w-4 h-4" />
            إنهاء مجاناً
          </button>
        {:else}
          <form
            method="POST"
            action="?/endSessionWithAmount"
            use:enhance={() => {
              return async ({ result }) => {
                if (result.type === 'success') {
                  const cost = finalCost / 100;
                  toast.success(`تم إنهاء الجلسة - ${cost.toFixed(1)} ج.م`);
                  closeEndSessionModal();
                  await invalidateAll();
                } else if (result.type === 'failure') {
                  toast.error(String(result.data?.error || 'فشل في إنهاء الجلسة'));
                } else {
                  toast.error('فشل في إنهاء الجلسة');
                }
              };
            }}
          >
            <input type="hidden" name="sessionId" value={activeSessionForEnd.sessionId} />
            <input type="hidden" name="finalAmount" value={finalCost} />
            <button type="submit" class="btn btn-primary">
              <Square class="w-4 h-4" />
              إنهاء الجلسة
            </button>
          </form>
        {/if}
        <button class="btn btn-ghost" onclick={closeEndSessionModal}>إلغاء</button>
      </div>
    </div>
  </div>
{/if}

<!-- Zero Amount Confirmation Modal -->
{#if showZeroConfirmModal && activeSessionForEnd}
  <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
  <div class="modal-overlay" onclick={() => showZeroConfirmModal = false}>
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div class="modal-box modal-rtl" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <button class="modal-close" onclick={() => showZeroConfirmModal = false}>
          <X class="w-5 h-5" />
        </button>
        <h3>تأكيد الإنهاء مجاناً</h3>
      </div>
      <div class="modal-body">
        <div class="confirm-warning">
          <AlertTriangle class="w-12 h-12" />
          <p>هل أنت متأكد من إنهاء الجلسة بدون تكلفة؟</p>
          <p class="warning-detail">
            المبلغ الحقيقي: <strong>{formatRevenue(activeSessionForEnd.calculatedCost + activeSessionForEnd.ordersTotal)} ج.م</strong>
          </p>
        </div>
      </div>
      <div class="modal-footer-rtl">
        <form
          method="POST"
          action="?/endSessionWithAmount"
          use:enhance={() => {
            return async ({ result }) => {
              if (result.type === 'success') {
                toast.success('تم إنهاء الجلسة مجاناً');
                showZeroConfirmModal = false;
                closeEndSessionModal();
                await invalidateAll();
              } else if (result.type === 'failure') {
                toast.error(String(result.data?.error || 'فشل في إنهاء الجلسة'));
              } else {
                toast.error('فشل في إنهاء الجلسة');
              }
            };
          }}
        >
          <input type="hidden" name="sessionId" value={activeSessionForEnd.sessionId} />
          <input type="hidden" name="finalAmount" value="0" />
          <button type="submit" class="btn btn-danger">
            <Square class="w-4 h-4" />
            نعم، إنهاء مجاناً
          </button>
        </form>
        <button class="btn btn-ghost" onclick={() => showZeroConfirmModal = false}>إلغاء</button>
      </div>
    </div>
  </div>
{/if}

<!-- Add/Edit Charge Modal -->
{#if showChargeModal && activeSessionForCharge}
  <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
  <div class="modal-overlay" onclick={closeChargeModal}>
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div class="modal-box modal-rtl" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <button class="modal-close" onclick={closeChargeModal}>
          <X class="w-5 h-5" />
        </button>
        <h3>{editingChargeId ? 'تعديل الرسوم' : 'إضافة رسوم'} - {activeSessionForCharge.stationName}</h3>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="charge-amount">المبلغ (ج.م)</label>
          <input
            type="number"
            id="charge-amount"
            class="input-modern"
            bind:value={chargeAmount}
            min="0.5"
            step="0.5"
            placeholder="0"
            required
          />
        </div>
        <div class="form-group">
          <label for="charge-reason">السبب (اختياري)</label>
          <input
            type="text"
            id="charge-reason"
            class="input-modern"
            bind:value={chargeReason}
            placeholder="مثال: كونترولر إضافي"
          />
        </div>
      </div>
      <div class="modal-footer-rtl">
        <form
          method="POST"
          action={editingChargeId ? "?/updateCharge" : "?/addCharge"}
          use:enhance={() => {
            return async ({ result }) => {
              if (result.type === 'success') {
                toast.success(editingChargeId ? 'تم تحديث الرسوم' : 'تم إضافة الرسوم');
                closeChargeModal();
                await invalidateAll();
              } else if (result.type === 'failure') {
                toast.error(String(result.data?.error || 'فشل في حفظ الرسوم'));
              } else {
                toast.error('فشل في حفظ الرسوم');
              }
            };
          }}
        >
          {#if editingChargeId}
            <input type="hidden" name="chargeId" value={editingChargeId} />
          {:else}
            <input type="hidden" name="sessionId" value={activeSessionForCharge.sessionId} />
          {/if}
          <input type="hidden" name="amount" value={chargeAmount} />
          <input type="hidden" name="reason" value={chargeReason} />
          <button type="submit" class="btn btn-primary" disabled={!chargeAmount || parseFloat(chargeAmount) <= 0}>
            <DollarSign class="w-4 h-4" />
            {editingChargeId ? 'تحديث' : 'إضافة'}
          </button>
        </form>
        <button class="btn btn-ghost" onclick={closeChargeModal}>إلغاء</button>
      </div>
    </div>
  </div>
{/if}

<!-- Transfer Session Modal -->
{#if showTransferModal && activeSessionForTransfer}
  {@const otherSessions = getOtherActiveSessions(activeSessionForTransfer.sessionId)}
  {@const transferAmount = activeSessionForTransfer.gamingCost + (transferIncludeOrders ? activeSessionForTransfer.ordersCost : 0)}

  <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
  <div class="modal-overlay" onclick={closeTransferModal}>
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div class="modal-box modal-lg modal-rtl" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <button class="modal-close" onclick={closeTransferModal}>
          <X class="w-5 h-5" />
        </button>
        <h3>تحويل جلسة - {activeSessionForTransfer.stationName}</h3>
      </div>
      <div class="modal-body">
        <p class="transfer-description">
          اختر الجهاز الذي تريد تحويل التكلفة إليه. سيتم إنهاء هذه الجلسة ونقل المبلغ للجلسة المختارة.
        </p>

        <!-- Transfer Amount Summary -->
        <div class="transfer-summary">
          <div class="transfer-summary-row">
            <span>تكلفة اللعب:</span>
            <span>{formatRevenue(activeSessionForTransfer.gamingCost)} ج.م</span>
          </div>
          {#if activeSessionForTransfer.ordersCost > 0}
            <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
            <div class="transfer-summary-row" onclick={(e) => e.stopPropagation()}>
              <label class="transfer-checkbox-label">
                <input type="checkbox" bind:checked={transferIncludeOrders} onclick={(e) => e.stopPropagation()} />
                <span>تضمين الطلبات ({formatRevenue(activeSessionForTransfer.ordersCost)} ج.م)</span>
              </label>
            </div>
          {/if}
          <div class="transfer-summary-row total">
            <span>المبلغ المحول:</span>
            <span class="transfer-amount">{formatRevenue(transferAmount)} ج.م</span>
          </div>
        </div>

        <!-- Target Session Selection -->
        <div class="target-session-selection">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label>اختر الجهاز المستهدف:</label>
          <div class="target-sessions-grid">
            {#each otherSessions as session}
              {@const station = stationStatuses?.find((s: any) => (s.station._id ?? s.station.id) === session.stationId)?.station}
              <button
                type="button"
                class="target-session-option"
                class:selected={transferTargetSessionId === session.id}
                onclick={(e) => { e.stopPropagation(); transferTargetSessionId = session.id; }}
              >
                <span class="target-station-name">{station?.nameAr || session.stationId}</span>
                <span class="target-station-id">{session.stationId}</span>
              </button>
            {/each}
          </div>
        </div>
      </div>
      <div class="modal-footer-rtl">
        <form
          method="POST"
          action="?/transferSession"
          use:enhance={() => {
            return async ({ result }) => {
              if (result.type === 'success') {
                toast.success('تم تحويل الجلسة بنجاح');
                closeTransferModal();
                await invalidateAll();
              } else if (result.type === 'failure') {
                toast.error(String(result.data?.error || 'فشل في تحويل الجلسة'));
              } else {
                toast.error('فشل في تحويل الجلسة');
              }
            };
          }}
        >
          <input type="hidden" name="fromSessionId" value={activeSessionForTransfer.sessionId} />
          <input type="hidden" name="toSessionId" value={transferTargetSessionId || ''} />
          <input type="hidden" name="includeOrders" value={transferIncludeOrders} />
          <button type="submit" class="btn btn-primary" disabled={!transferTargetSessionId}>
            <ArrowRightLeft class="w-4 h-4" />
            تحويل وإنهاء
          </button>
        </form>
        <button class="btn btn-ghost" onclick={closeTransferModal}>إلغاء</button>
      </div>
    </div>
  </div>
{/if}

<!-- Switch Station Modal -->
{#if showSwitchStationModal && activeSessionForSwitch}
  {@const availableStations = getAvailableStations(activeSessionForSwitch.currentStationId)}

  <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
  <div class="modal-overlay" onclick={closeSwitchStationModal}>
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div class="modal-box modal-lg modal-rtl" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <button class="modal-close" onclick={closeSwitchStationModal}>
          <X class="w-5 h-5" />
        </button>
        <h3>نقل الجلسة - {activeSessionForSwitch.stationName}</h3>
      </div>
      <div class="modal-body">
        <p class="transfer-description">
          اختر الجهاز الذي تريد نقل الجلسة إليه. ستستمر الجلسة على الجهاز الجديد.
        </p>

        {#if availableStations.length === 0}
          <div class="no-stations-message">
            <AlertTriangle class="w-8 h-8" />
            <p>لا توجد أجهزة متاحة للنقل</p>
            <span class="hint">جميع الأجهزة الأخرى مشغولة أو في الصيانة</span>
          </div>
        {:else}
          <div class="target-session-selection">
            <!-- svelte-ignore a11y_label_has_associated_control -->
          <label>اختر الجهاز المستهدف:</label>
            <div class="target-sessions-grid">
              {#each availableStations as station}
                <button
                  type="button"
                  class="target-session-option"
                  class:selected={switchTargetStationId === station.id}
                  onclick={(e) => { e.stopPropagation(); switchTargetStationId = station.id; }}
                >
                  <span class="target-station-name">{station.nameAr}</span>
                  <span class="target-station-id">{station.stationId || station.name}</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
      <div class="modal-footer-rtl">
        <form
          method="POST"
          action="?/switchStation"
          use:enhance={() => {
            return async ({ result }) => {
              if (result.type === 'success') {
                toast.success('تم نقل الجلسة بنجاح');
                closeSwitchStationModal();
                await invalidateAll();
              } else if (result.type === 'failure') {
                toast.error(String(result.data?.error || 'فشل في نقل الجلسة'));
              } else {
                toast.error('فشل في نقل الجلسة');
              }
            };
          }}
        >
          <input type="hidden" name="sessionId" value={activeSessionForSwitch.sessionId} />
          <input type="hidden" name="newStationId" value={switchTargetStationId || ''} />
          <button type="submit" class="btn btn-primary" disabled={!switchTargetStationId || availableStations.length === 0}>
            <Repeat class="w-4 h-4" />
            نقل الجلسة
          </button>
        </form>
        <button class="btn btn-ghost" onclick={closeSwitchStationModal}>إلغاء</button>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Start Time Modal -->
{#if showEditStartTimeModal && editStartTimeSessionId}
  <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
  <div class="modal-overlay" onclick={closeEditStartTimeModal}>
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div class="modal-box modal-time-edit modal-rtl" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <button class="modal-close" onclick={closeEditStartTimeModal}>
          <X class="w-5 h-5" />
        </button>
        <h3>
          <Clock class="w-5 h-5" />
          تعديل وقت البداية
        </h3>
      </div>
      <div class="modal-body">
        <div class="edit-time-container">
          <div class="today-badge">
            <span>اليوم</span>
            <span class="today-date">{new Date().toLocaleDateString('ar-EG', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          </div>
          <div class="time-input-large">
            <div class="time-12h-picker">
              <div class="time-12h-toggle">
                <button
                  class="period-btn"
                  class:active={editStartTimePeriod === 'AM'}
                  onclick={() => editStartTimePeriod = 'AM'}
                >ص</button>
                <button
                  class="period-btn"
                  class:active={editStartTimePeriod === 'PM'}
                  onclick={() => editStartTimePeriod = 'PM'}
                >م</button>
              </div>
              <div class="time-12h-fields">
                <input
                  type="number"
                  class="time-12h-input"
                  min="1" max="12"
                  bind:value={editStartTimeHour}
                  onchange={(e) => {
                    let v = parseInt(e.currentTarget.value, 10);
                    if (isNaN(v) || v < 1) v = 1;
                    if (v > 12) v = 12;
                    editStartTimeHour = v.toString().padStart(2, '0');
                  }}
                />
                <span class="time-12h-sep">:</span>
                <input
                  type="number"
                  class="time-12h-input"
                  min="0" max="59"
                  bind:value={editStartTimeMinute}
                  onchange={(e) => {
                    let v = parseInt(e.currentTarget.value, 10);
                    if (isNaN(v) || v < 0) v = 0;
                    if (v > 59) v = 59;
                    editStartTimeMinute = v.toString().padStart(2, '0');
                  }}
                />
              </div>
            </div>
          </div>
          <p class="edit-time-note">سيتم إعادة حساب التكلفة تلقائياً</p>
        </div>
      </div>
      <div class="modal-footer-rtl">
        <form
          method="POST"
          action="?/updateStartTime"
          use:enhance={() => {
            return async ({ result }) => {
              if (result.type === 'success') {
                toast.success('تم تعديل وقت البداية');
                closeEditStartTimeModal();
                await invalidateAll();
              } else if (result.type === 'failure') {
                toast.error(String(result.data?.error || 'فشل في تعديل وقت البداية'));
              } else {
                toast.error('فشل في تعديل وقت البداية');
              }
            };
          }}
        >
          <input type="hidden" name="sessionId" value={editStartTimeSessionId} />
          <input type="hidden" name="newStartTime" value={editStartTimeHour && editStartTimeMinute ? timeToTodayTimestamp(to24h(editStartTimeHour, editStartTimeMinute, editStartTimePeriod)) : ''} />
          <button type="submit" class="btn btn-primary btn-lg" disabled={!editStartTimeHour || !editStartTimeMinute}>
            <Clock class="w-5 h-5" />
            حفظ
          </button>
        </form>
        <button class="btn btn-ghost" onclick={closeEditStartTimeModal}>إلغاء</button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Loading Skeleton */
  .skeleton {
    background: linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 75%);
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.5s ease-in-out infinite;
    border-radius: 6px;
  }

  .skeleton-text {
    height: 14px;
    display: block;
  }

  .skeleton-value {
    height: 28px;
    display: block;
  }

  .skeleton-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
  }

  .skeleton-badge {
    display: block;
  }

  .skeleton-block {
    display: block;
    width: 100%;
  }

  .skeleton-station-body {
    padding: 0 4px;
  }

  @keyframes skeleton-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .playstation-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .sync-btn,
  .settings-btn,
  .menu-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(8, 145, 178, 0.1);
    border: 1px solid rgba(8, 145, 178, 0.3);
    color: var(--color-primary-light);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .menu-btn {
    background: rgba(245, 158, 11, 0.1);
    border-color: rgba(245, 158, 11, 0.3);
    color: #fbbf24;
  }

  .sync-btn:hover:not(:disabled),
  .settings-btn:hover {
    background: rgba(8, 145, 178, 0.2);
    border-color: var(--color-primary);
  }

  .menu-btn:hover {
    background: rgba(245, 158, 11, 0.2);
    border-color: #fbbf24;
  }

  .sync-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Sound Toggle Button */
  .sound-toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
  }

  .sound-toggle-btn.active {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.3);
    color: #34d399;
  }

  .sound-toggle-btn:hover {
    transform: scale(1.05);
  }

  .sound-off-line {
    position: absolute;
    width: 24px;
    height: 2px;
    background: #f87171;
    transform: rotate(-45deg);
    border-radius: 1px;
  }

  /* Background Sync Status Button */
  .sync-status-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 20px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
  }

  .sync-status-btn.active {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.3);
    color: #34d399;
  }

  .sync-status-btn.error {
    background: rgba(245, 158, 11, 0.1);
    border-color: rgba(245, 158, 11, 0.3);
    color: #fbbf24;
  }

  .sync-status-btn:hover:not(:disabled) {
    transform: scale(1.02);
  }

  .sync-status-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .sync-status-text {
    white-space: nowrap;
  }

  .sync-pulse {
    position: absolute;
    top: 50%;
    right: 8px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #34d399;
    transform: translateY(-50%);
    animation: pulse-dot 2s ease-in-out infinite;
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; transform: translateY(-50%) scale(1); }
    50% { opacity: 0.5; transform: translateY(-50%) scale(1.5); }
  }

  /* Timer Alerts */
  .alerts-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .timer-alert {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.05) 100%);
    border: 1px solid rgba(239, 68, 68, 0.4);
    animation: pulse-alert 2s ease-in-out infinite;
  }

  @keyframes pulse-alert {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.3); }
    50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
  }

  .alert-icon {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(239, 68, 68, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #f87171;
    animation: ring 1s ease-in-out infinite;
  }

  @keyframes ring {
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(15deg); }
    75% { transform: rotate(-15deg); }
  }

  .alert-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .alert-title {
    font-weight: 600;
    color: #f87171;
    font-size: 14px;
  }

  .alert-station {
    color: var(--color-text-secondary);
    font-size: 13px;
  }

  .alert-dismiss {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--color-text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .alert-dismiss:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-primary);
  }

  /* Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
  }

  .stat-card {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .stat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .stat-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .stat-icon-wrapper {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .stat-icon-primary {
    background: rgba(8, 145, 178, 0.15);
    color: var(--color-primary-light);
    border: 1px solid rgba(8, 145, 178, 0.3);
  }

  .stat-icon-success {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .stat-icon-warning {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .stat-value {
    font-size: 28px;
    font-weight: 700;
    color: var(--color-text-primary);
    line-height: 1;
  }

  .stat-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .stat-subtitle {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  /* Section */
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .view-all-link {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    color: var(--color-primary-light);
    text-decoration: none;
    transition: color 0.2s;
  }

  .view-all-link:hover {
    color: var(--color-primary);
  }

  /* Stations Grid */
  .stations-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  .station-card {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    transition: all 0.3s ease;
    border: 2px solid transparent;
  }

  .station-card:hover {
    transform: translateY(-2px);
  }

  /* Monitor Controls */
  .monitor-controls {
    display: flex;
    gap: 6px;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .monitor-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    cursor: pointer;
    transition: all 0.2s;
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-text-secondary);
  }

  .monitor-btn:hover:not(:disabled) {
    transform: scale(1.05);
  }

  .monitor-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .monitor-btn-on {
    background: rgba(34, 197, 94, 0.15);
    border-color: rgba(34, 197, 94, 0.3);
    color: #22c55e;
  }

  .monitor-btn-on:hover:not(:disabled) {
    background: rgba(34, 197, 94, 0.25);
    border-color: rgba(34, 197, 94, 0.5);
  }

  .monitor-btn-off {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }

  .monitor-btn-off:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.25);
    border-color: rgba(239, 68, 68, 0.5);
  }

  .monitor-btn-hdmi {
    background: rgba(59, 130, 246, 0.15);
    border-color: rgba(59, 130, 246, 0.3);
    color: #3b82f6;
  }

  .monitor-btn-hdmi:hover:not(:disabled) {
    background: rgba(59, 130, 246, 0.25);
    border-color: rgba(59, 130, 246, 0.5);
  }

  .loading-spinner-sm {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  /* Station Status Colors */
  .station-available {
    border-color: rgba(16, 185, 129, 0.3);
  }

  .station-occupied {
    border-color: rgba(245, 158, 11, 0.5);
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, transparent 100%);
  }

  .station-maintenance {
    border-color: rgba(239, 68, 68, 0.3);
    opacity: 0.7;
  }

  .station-offline-session {
    border-color: rgba(239, 68, 68, 0.7) !important;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.05) 100%) !important;
    box-shadow: 0 0 20px rgba(239, 68, 68, 0.3);
    opacity: 1 !important;
  }

  .station-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .station-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .station-name {
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .station-id {
    font-size: 12px;
    font-family: monospace;
    color: var(--color-text-muted);
  }

  .station-net-info {
    font-size: 11px;
    font-family: monospace;
    color: var(--color-text-muted);
    opacity: 0.6;
  }

  .station-status {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-badge {
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
  }

  .status-available {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .status-occupied {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .status-maintenance {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .status-offline-session {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.4);
  }

  .online-indicator {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    transition: all 0.2s;
  }

  .online-indicator.online {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .internet-toggle {
    height: 26px;
    padding: 0 8px;
    border-radius: 13px;
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(239, 68, 68, 0.12);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.25);
    cursor: pointer;
    transition: all 0.2s;
    font-size: 11px;
    font-weight: 600;
  }

  .internet-toggle:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
  }

  .internet-toggle.active {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
    border-color: rgba(34, 197, 94, 0.3);
  }

  .internet-toggle.active:hover {
    background: rgba(34, 197, 94, 0.25);
    border-color: rgba(34, 197, 94, 0.45);
  }

  .internet-toggle:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .internet-label {
    white-space: nowrap;
  }

  /* Session Info */
  .session-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .timer-display,
  .cost-display {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .timer-display {
    color: var(--color-primary-light);
  }

  .timer-display.paused {
    color: #f97316; /* Orange for paused */
    animation: pulse-pause 1.5s ease-in-out infinite;
  }

  @keyframes pulse-pause {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .timer-value {
    font-size: 20px;
    font-weight: 700;
    font-family: monospace;
  }

  .cost-display {
    color: #34d399;
  }

  .cost-value {
    font-size: 18px;
    font-weight: 600;
  }

  /* Total Cost Display */
  .total-cost-display {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: linear-gradient(135deg, rgba(8, 145, 178, 0.15) 0%, rgba(8, 145, 178, 0.05) 100%);
    border: 1px solid rgba(8, 145, 178, 0.3);
    border-radius: 10px;
  }

  .total-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-primary-light);
  }

  .total-amount {
    font-size: 22px;
    font-weight: 700;
    color: var(--color-primary-light);
    font-family: monospace;
  }

  .offline-warning {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.4);
    border-radius: 8px;
    color: #f87171;
    font-size: 13px;
    font-weight: 500;
  }

  /* Last Session Summary */
  .last-session-summary {
    padding: 16px;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.05) 100%);
    border: 2px solid rgba(245, 158, 11, 0.4);
    border-radius: 12px;
    animation: highlight-pulse 2s ease-in-out infinite;
  }

  @keyframes highlight-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.3); }
    50% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
  }

  .last-session-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(245, 158, 11, 0.3);
  }

  .last-session-label {
    font-size: 14px;
    font-weight: 600;
    color: #fbbf24;
  }

  .last-session-time {
    font-size: 14px;
    color: var(--color-text-muted);
    font-family: monospace;
  }

  .last-session-details {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .last-session-breakdown {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    color: var(--color-text-secondary);
  }

  .last-session-total {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(245, 158, 11, 0.3);
    font-size: 16px;
    font-weight: 600;
    color: #fbbf24;
  }

  .last-session-total .total-value {
    font-size: 22px;
    font-weight: 700;
    font-family: monospace;
  }

  .rate-info {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px;
    color: var(--color-text-secondary);
    font-size: 14px;
  }

  .rate-value {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  /* Actions */
  .station-actions {
    display: flex;
    justify-content: center;
    gap: 8px;
  }

  .btn-station {
    flex: 1;
    justify-content: center;
    gap: 8px;
  }

  .btn-station-small {
    flex: 0 0 auto;
    justify-content: center;
    gap: 4px;
    padding: 8px 12px;
    font-size: 0.85rem;
  }

  .maintenance-notice {
    text-align: center;
    color: var(--color-text-muted);
    font-size: 13px;
    padding: 8px;
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    text-align: center;
  }

  .empty-state h3 {
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin-top: 16px;
    margin-bottom: 8px;
  }

  .empty-state p {
    color: var(--color-text-muted);
    font-size: 14px;
  }

  /* Session Time Row */
  .session-time-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .session-time-label {
    color: var(--color-text-muted);
  }

  .timer-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 4px;
    font-family: monospace;
    font-weight: 600;
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .timer-badge.expired {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border-color: rgba(239, 68, 68, 0.3);
    animation: blink 1s ease-in-out infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Orders Summary */
  .orders-summary {
    background: rgba(245, 158, 11, 0.05);
    border: 1px solid rgba(245, 158, 11, 0.2);
    border-radius: 8px;
    overflow: hidden;
  }

  .orders-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: rgba(245, 158, 11, 0.1);
  }

  .orders-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 500;
    color: #fbbf24;
  }

  .orders-total {
    font-size: 14px;
    font-weight: 600;
    color: #fbbf24;
  }

  .orders-list {
    display: flex;
    flex-direction: column;
    max-height: 120px;
    overflow-y: auto;
  }

  .order-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .order-item:last-child {
    border-bottom: none;
  }

  .order-name {
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .order-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .order-price {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .order-remove-btn {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    background: rgba(239, 68, 68, 0.1);
    border: none;
    color: #f87171;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .order-remove-btn:hover {
    background: rgba(239, 68, 68, 0.2);
  }

  /* Add Order Panel */
  .add-order-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 8px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px dashed rgba(245, 158, 11, 0.3);
    border-radius: 8px;
    color: #fbbf24;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .add-order-toggle:hover {
    background: rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.5);
  }

  .add-order-panel {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.03);
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .panel-close {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .panel-close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-primary);
  }

  .menu-items-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
    padding: 8px;
    max-height: 180px;
    overflow-y: auto;
  }

  .menu-item-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px;
    background: rgba(16, 185, 129, 0.05);
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .menu-item-btn:hover {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.4);
  }

  .menu-item-name {
    font-size: 11px;
    color: var(--color-text-primary);
    text-align: center;
  }

  .menu-item-price {
    font-size: 10px;
    color: #34d399;
    font-weight: 600;
  }

  /* Timer Select */
  .start-session-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .timer-select {
    width: 100%;
  }

  .timer-dropdown {
    width: 100%;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: var(--color-text-primary);
    font-size: 13px;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: left 12px center;
    padding-left: 32px;
  }

  .timer-dropdown:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  /* Session Start Time - BIGGER */
  .session-start-time {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: rgba(8, 145, 178, 0.1);
    border: 1px solid rgba(8, 145, 178, 0.2);
    border-radius: 10px;
    color: var(--color-primary-light);
  }

  .start-time-value {
    font-size: 22px;
    font-weight: 700;
    font-family: monospace;
    letter-spacing: 1px;
  }

  .edit-time-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: rgba(99, 102, 241, 0.1);
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 6px;
    color: var(--color-primary-light);
    cursor: pointer;
    transition: all 0.2s;
    opacity: 0.7;
  }

  .edit-time-btn:hover {
    opacity: 1;
    background: rgba(99, 102, 241, 0.2);
    transform: scale(1.1);
  }


  .limit-hint {
    font-size: 12px;
    color: var(--color-text-muted);
    margin-top: 6px;
  }

  .edit-time-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .edit-time-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: var(--color-text);
  }

  .edit-time-hint {
    font-size: 12px;
    color: var(--color-text-muted);
    margin-top: 4px;
  }

  /* Time Picker Styles */
  .time-picker-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .time-input {
    width: 140px;
    font-size: 18px;
    font-family: monospace;
    text-align: center;
    padding: 10px 16px;
  }

  .clear-time-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: #f87171;
    cursor: pointer;
    transition: all 0.2s;
  }

  .clear-time-btn:hover {
    background: rgba(239, 68, 68, 0.2);
  }

  /* Edit Time Modal - Improved */
  .modal-time-edit {
    max-width: 340px;
  }

  .modal-time-edit .modal-header h3 {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .edit-time-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 8px 0;
  }

  .today-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 20px;
    background: rgba(99, 102, 241, 0.1);
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 10px;
    color: var(--color-primary-light);
  }

  .today-badge span:first-child {
    font-size: 12px;
    opacity: 0.8;
  }

  .today-date {
    font-size: 14px;
    font-weight: 600;
  }

  .time-input-large {
    display: flex;
    justify-content: center;
  }

  .time-12h-picker {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .time-12h-fields {
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(255, 255, 255, 0.05);
    border: 2px solid rgba(99, 102, 241, 0.4);
    border-radius: 12px;
    padding: 12px 20px;
  }

  .time-12h-input {
    font-size: 36px;
    font-family: monospace;
    font-weight: 700;
    text-align: center;
    background: transparent;
    border: none;
    color: var(--color-text);
    width: 72px;
    -moz-appearance: textfield;
  }

  .time-12h-input::-webkit-outer-spin-button,
  .time-12h-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .time-12h-input:focus {
    outline: none;
    background: rgba(99, 102, 241, 0.1);
    border-radius: 8px;
  }

  .time-12h-sep {
    font-size: 36px;
    font-family: monospace;
    font-weight: 700;
    color: var(--color-text);
    opacity: 0.5;
  }

  .time-12h-toggle {
    display: flex;
    gap: 4px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 2px;
  }

  .period-btn {
    padding: 6px 20px;
    font-size: 16px;
    font-weight: 600;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    background: transparent;
    color: var(--color-text-muted);
  }

  .period-btn.active {
    background: var(--color-primary);
    color: white;
  }

  .period-btn:not(.active):hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .edit-time-note {
    font-size: 12px;
    color: var(--color-text-muted);
    text-align: center;
  }

  .btn-lg {
    padding: 12px 24px;
    font-size: 16px;
  }

  .timer-badge-large {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    margin-right: auto;
    border-radius: 6px;
    font-family: monospace;
    font-size: 16px;
    font-weight: 600;
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .timer-badge-large.expired {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border-color: rgba(239, 68, 68, 0.3);
    animation: blink 1s ease-in-out infinite;
  }

  /* Orders Section - Compact */
  .orders-section {
    margin-top: 8px;
    background: rgba(245, 158, 11, 0.05);
    border: 1px solid rgba(245, 158, 11, 0.2);
    border-radius: 10px;
    overflow: hidden;
  }

  .orders-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    background: rgba(245, 158, 11, 0.1);
  }

  .orders-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 500;
    color: #fbbf24;
  }

  .orders-count {
    font-size: 12px;
    opacity: 0.8;
  }

  .add-order-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 6px;
    color: #34d399;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .add-order-btn:hover {
    background: rgba(16, 185, 129, 0.25);
  }

  .orders-list-compact {
    padding: 6px 10px;
  }

  .order-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    font-size: 13px;
  }

  .order-row:last-child {
    border-bottom: none;
  }

  .order-details {
    color: var(--color-text-secondary);
  }

  .order-row-end {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .remove-order-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    background: rgba(239, 68, 68, 0.1);
    border: none;
    color: #f87171;
    cursor: pointer;
    opacity: 0.6;
    transition: all 0.2s;
  }

  .order-row:hover .remove-order-btn {
    opacity: 1;
  }

  .remove-order-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    transform: scale(1.1);
  }

  .order-cost {
    color: var(--color-text-muted);
    font-family: monospace;
  }

  .orders-total-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0 4px;
    margin-top: 4px;
    border-top: 1px solid rgba(245, 158, 11, 0.3);
    font-size: 14px;
    font-weight: 600;
    color: #fbbf24;
  }

  .total-value {
    font-family: monospace;
  }

  .no-orders {
    padding: 8px 12px;
    text-align: center;
    color: var(--color-text-muted);
    font-size: 12px;
    margin: 0;
    font-size: 13px;
  }

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .modal-box {
    background: var(--color-bg-card);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    width: 100%;
    max-width: 400px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: modalSlideIn 0.2s ease-out;
  }

  .modal-box.modal-lg {
    max-width: 500px;
  }

  @keyframes modalSlideIn {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .modal-header h3 {
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
  }

  .modal-close {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--color-text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .modal-close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-primary);
  }

  .modal-body {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  /* RTL Modal Styles */
  .modal-rtl .modal-header {
    flex-direction: row-reverse;
    justify-content: flex-start;
    gap: 12px;
  }

  .modal-rtl .modal-header h3 {
    flex: 1;
    text-align: right;
  }

  .modal-footer-rtl {
    display: flex;
    align-items: center;
    flex-direction: row-reverse;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  /* Timer Button */
  .set-timer-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-right: auto;
    padding: 6px 12px;
    background: rgba(139, 92, 246, 0.1);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 8px;
    color: #a78bfa;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .set-timer-btn:hover {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.5);
  }

  .set-timer-btn.has-timer {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.3);
    color: #34d399;
  }

  .set-timer-btn.has-timer:hover {
    background: rgba(16, 185, 129, 0.2);
    border-color: rgba(16, 185, 129, 0.5);
  }

  .set-timer-btn.expired {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: #f87171;
    animation: blink 1s ease-in-out infinite;
  }

  .set-timer-btn.expired:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
  }

  .btn-ghost {
    padding: 10px 20px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: var(--color-text-secondary);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-ghost:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-text-primary);
  }

  /* Duration Grid */
  .duration-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .limit-section {
    margin-bottom: 16px;
  }

  .limit-section:last-child {
    margin-bottom: 0;
  }

  .limit-section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-primary-light);
    margin-bottom: 12px;
  }

  .duration-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 16px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .duration-option:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .duration-option.selected {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.5);
  }

  .duration-label {
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .duration-desc {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .duration-option.selected .duration-label {
    color: #34d399;
  }

  /* Menu Categories */
  .menu-categories {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .category-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .category-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .menu-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .menu-item-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    transition: all 0.2s;
  }

  .menu-item-card:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .menu-item-card.in-cart {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.5);
  }

  .item-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .item-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .item-price {
    font-size: 13px;
    color: #34d399;
    font-weight: 600;
  }

  .menu-item-card.in-cart .item-name {
    color: #34d399;
  }

  .item-controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .qty-btn-sm {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: var(--color-text-primary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .qty-btn-sm:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .qty-btn-sm.add {
    background: rgba(16, 185, 129, 0.2);
    border-color: rgba(16, 185, 129, 0.4);
    color: #34d399;
  }

  .qty-btn-sm.add:hover {
    background: rgba(16, 185, 129, 0.3);
    border-color: rgba(16, 185, 129, 0.6);
  }

  .qty-badge {
    min-width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(16, 185, 129, 0.3);
    color: #34d399;
    font-size: 13px;
    font-weight: 700;
    border-radius: 6px;
    font-family: monospace;
  }

  /* Cart Summary */
  .cart-summary {
    margin-top: 16px;
    padding: 16px;
    background: rgba(16, 185, 129, 0.05);
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-radius: 12px;
  }

  .cart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .cart-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .cart-total {
    font-size: 18px;
    font-weight: 700;
    color: #34d399;
    font-family: monospace;
  }

  .cart-items {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .cart-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .cart-item-name {
    font-size: 13px;
    color: var(--color-text-secondary);
  }

  .cart-item-price {
    font-size: 13px;
    color: var(--color-text-primary);
    font-family: monospace;
  }

  /* Quantity Section */
  .quantity-section {
    margin-top: 16px;
    padding: 16px;
    background: rgba(16, 185, 129, 0.05);
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-radius: 12px;
  }

  .selected-item-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .selected-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .selected-price {
    font-size: 18px;
    font-weight: 700;
    color: #34d399;
    font-family: monospace;
  }

  .quantity-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
  }

  .qty-btn {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: var(--color-text-primary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .qty-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    border-color: var(--color-primary);
  }

  .qty-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .qty-value {
    font-size: 32px;
    font-weight: 700;
    color: var(--color-text-primary);
    min-width: 60px;
    text-align: center;
    font-family: monospace;
  }

  /* Big PS Number Card */
  .ps-big-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(8, 145, 178, 0.2) 100%);
    border: 2px solid rgba(139, 92, 246, 0.4);
    border-radius: 16px;
    text-align: center;
  }

  .ps-big-number {
    font-size: 48px;
    font-weight: 800;
    color: #a78bfa;
    font-family: monospace;
    line-height: 1;
    text-shadow: 0 2px 10px rgba(139, 92, 246, 0.3);
  }

  .ps-big-name {
    font-size: 24px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin-top: 8px;
  }

  /* End Session Modal */
  .end-session-summary {
    padding: 16px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    margin-bottom: 20px;
  }

  .cost-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    font-size: 14px;
    color: var(--color-text-secondary);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .cost-row:last-child {
    border-bottom: none;
  }

  .cost-row.total-row {
    padding-top: 12px;
    margin-top: 4px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    border-bottom: none;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .cost-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .cost-options h4 {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-secondary);
    margin: 0 0 8px 0;
  }

  .cost-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    background: rgba(255, 255, 255, 0.03);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: right;
  }

  .cost-option:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .cost-option.selected {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.5);
  }

  .option-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .option-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .option-desc {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .cost-option.selected .option-title {
    color: #34d399;
  }

  .option-value {
    font-size: 20px;
    font-weight: 700;
    color: #34d399;
    font-family: monospace;
  }

  .option-value.zero {
    color: #f87171;
  }

  .option-value.custom {
    color: var(--color-text-muted);
  }

  .custom-input-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .custom-amount-input {
    width: 80px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(16, 185, 129, 0.5);
    border-radius: 8px;
    color: #34d399;
    font-size: 18px;
    font-weight: 600;
    font-family: monospace;
    text-align: center;
  }

  .custom-amount-input:focus {
    outline: none;
    border-color: #34d399;
    background: rgba(16, 185, 129, 0.1);
  }

  .custom-amount-input::placeholder {
    color: var(--color-text-muted);
  }

  .input-suffix {
    font-size: 14px;
    color: var(--color-text-muted);
  }

  .final-amount-display {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    margin-top: 20px;
    background: linear-gradient(135deg, rgba(8, 145, 178, 0.15) 0%, rgba(8, 145, 178, 0.05) 100%);
    border: 2px solid rgba(8, 145, 178, 0.4);
    border-radius: 12px;
  }

  .final-label {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-primary-light);
  }

  .final-value {
    font-size: 28px;
    font-weight: 800;
    color: var(--color-primary-light);
    font-family: monospace;
  }

  .final-value.zero {
    color: #f87171;
  }

  /* Zero Confirmation Modal */
  .confirm-warning {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 24px;
    text-align: center;
    color: #fbbf24;
  }

  .confirm-warning p {
    margin: 0;
    font-size: 16px;
    color: var(--color-text-primary);
  }

  .confirm-warning .warning-detail {
    font-size: 14px;
    color: var(--color-text-secondary);
  }

  .confirm-warning .warning-detail strong {
    color: #f87171;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .stations-grid {
      grid-template-columns: 1fr;
    }

    .stats-grid {
      grid-template-columns: 1fr;
    }

    .menu-grid {
      grid-template-columns: 1fr;
    }

    .duration-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .modal-box {
      max-width: none;
      margin: 10px;
    }

    .ps-big-number {
      font-size: 36px;
    }

    .ps-big-name {
      font-size: 20px;
    }

    .cost-option {
      padding: 12px;
    }

    .option-value {
      font-size: 16px;
    }

    .final-value {
      font-size: 22px;
    }
  }

  /* Multi-Mode Card Styling */
  .station-card.multi-mode {
    border-color: rgba(168, 85, 247, 0.5) !important;
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(168, 85, 247, 0.05) 100%) !important;
    box-shadow: 0 0 20px rgba(168, 85, 247, 0.2), inset 0 1px 0 rgba(168, 85, 247, 0.1) !important;
  }

  .station-card.multi-mode .ps-big-card {
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%);
    border-color: rgba(168, 85, 247, 0.3);
  }

  .station-card.multi-mode .ps-big-number {
    color: #c4b5fd;
  }

  .station-card.multi-mode .total-cost-display {
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%);
    border-color: rgba(168, 85, 247, 0.3);
  }

  .station-card.multi-mode .total-amount {
    color: #c4b5fd;
  }

  /* Total at bottom - more prominent */
  .total-cost-display.total-at-bottom {
    margin-top: 8px;
    padding: 12px;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.1) 100%);
    border: 2px solid rgba(16, 185, 129, 0.4);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
  }

  .total-cost-display.total-at-bottom .total-label {
    font-size: 14px;
    font-weight: 600;
    color: #34d399;
  }

  .total-cost-display.total-at-bottom .total-amount {
    font-size: 28px;
    font-weight: 700;
    color: #34d399;
  }

  .station-card.multi-mode .total-cost-display.total-at-bottom {
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(168, 85, 247, 0.1) 100%);
    border-color: rgba(168, 85, 247, 0.4);
    box-shadow: 0 4px 12px rgba(168, 85, 247, 0.15);
  }

  .station-card.multi-mode .total-cost-display.total-at-bottom .total-label,
  .station-card.multi-mode .total-cost-display.total-at-bottom .total-amount {
    color: #c4b5fd;
  }

  /* Mode Toggle */
  .mode-toggle-row {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .mode-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-text-secondary);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .mode-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .mode-btn.active {
    background: rgba(8, 145, 178, 0.2);
    border-color: rgba(8, 145, 178, 0.5);
    color: var(--color-primary-light);
  }

  /* Multi mode button active state - purple */
  .mode-btn:last-child.active {
    background: rgba(168, 85, 247, 0.2);
    border-color: rgba(168, 85, 247, 0.5);
    color: #c4b5fd;
  }

  /* Charges Section */
  .charges-section {
    margin-top: 8px;
    background: rgba(8, 145, 178, 0.05);
    border: 1px solid rgba(8, 145, 178, 0.2);
    border-radius: 10px;
    overflow: hidden;
  }

  .charges-section .orders-header-row {
    background: rgba(8, 145, 178, 0.1);
  }

  .charges-section .orders-label {
    color: var(--color-primary-light);
  }

  .edit-order-btn {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    background: rgba(8, 145, 178, 0.1);
    border: none;
    color: var(--color-primary-light);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .edit-order-btn:hover {
    background: rgba(8, 145, 178, 0.2);
  }

  /* Transfers Section */
  .transfers-section {
    margin-top: 8px;
    background: rgba(139, 92, 246, 0.05);
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 10px;
    overflow: hidden;
  }

  .transfers-section .orders-header-row {
    background: rgba(139, 92, 246, 0.1);
  }

  .transfers-section .orders-label {
    color: #a78bfa;
  }

  .transfer-row {
    background: rgba(139, 92, 246, 0.1);
    border-radius: 4px;
    padding: 4px 8px !important;
  }

  .transfer-row-highlight {
    background: rgba(139, 92, 246, 0.1);
    border-radius: 4px;
    padding: 8px;
    color: #a78bfa;
  }

  /* Transfer Option in End Session Modal */
  .transfer-option-section {
    margin: 16px 0;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .transfer-option-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 10px;
    border: 1px solid rgba(139, 92, 246, 0.3);
    background: rgba(139, 92, 246, 0.1);
    color: #a78bfa;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: start;
  }

  .transfer-option-btn:hover {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.5);
  }

  .transfer-option-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .transfer-option-title {
    font-size: 14px;
    font-weight: 600;
  }

  .transfer-option-desc {
    font-size: 12px;
    opacity: 0.7;
  }

  /* Transfer Modal Styles */
  .transfer-description {
    color: var(--color-text-secondary);
    font-size: 14px;
    margin-bottom: 16px;
    line-height: 1.5;
  }

  .transfer-summary {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 16px;
  }

  .transfer-summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    font-size: 14px;
    color: var(--color-text-secondary);
  }

  .transfer-summary-row.total {
    padding-top: 12px;
    margin-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .transfer-amount {
    color: #a78bfa;
    font-size: 18px;
  }

  .transfer-checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .transfer-checkbox-label input {
    width: 16px;
    height: 16px;
    accent-color: #a78bfa;
  }

  .target-session-selection {
    margin-top: 16px;
  }

  .target-session-selection label {
    display: block;
    font-size: 14px;
    color: var(--color-text-secondary);
    margin-bottom: 12px;
  }

  .target-sessions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 8px;
  }

  .target-session-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .target-session-option:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .target-session-option.selected {
    border-color: rgba(139, 92, 246, 0.5);
    background: rgba(139, 92, 246, 0.15);
  }

  .target-station-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .target-station-id {
    font-size: 11px;
    color: var(--color-text-muted);
  }

  .no-stations-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    text-align: center;
    color: var(--color-text-muted);
    gap: 8px;
  }

  .no-stations-message p {
    font-size: 16px;
    font-weight: 500;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .no-stations-message .hint {
    font-size: 13px;
    opacity: 0.7;
  }

  /* Segment breakdown in end session modal */
  .segment-row {
    font-size: 13px;
    padding: 4px 0;
    opacity: 0.8;
  }

  .subtotal-row {
    padding-top: 8px;
    margin-top: 4px;
    border-top: 1px dashed rgba(255, 255, 255, 0.1);
  }

  /* Form group in modals */
  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    font-size: 13px;
    color: var(--color-text-secondary);
    margin-bottom: 6px;
  }

  .input-modern {
    width: 100%;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-text-primary);
    font-size: 14px;
    transition: all 0.2s ease;
  }

  .input-modern:focus {
    outline: none;
    border-color: rgba(8, 145, 178, 0.5);
    background: rgba(255, 255, 255, 0.08);
  }

  .input-modern::placeholder {
    color: var(--color-text-muted);
  }
</style>
