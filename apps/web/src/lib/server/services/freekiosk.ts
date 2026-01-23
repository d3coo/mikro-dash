/**
 * FreeKiosk Integration Service
 *
 * Controls Android monitors running FreeKiosk app via REST API.
 * Used for PlayStation station monitors to:
 * - Turn screen on/off
 * - Display notifications (TTS, beep)
 * - Show timer countdowns
 */

interface FreeKioskConfig {
  ip: string;
  port: number;
  apiKey?: string;
}

interface FreeKioskResponse {
  success: boolean;
  error?: string;
  data?: unknown;
}

interface MonitorHealth {
  ip: string;
  port: number;
  online: boolean;
  lastChecked: Date;
  lastSeen?: Date;
  consecutiveFailures: number;
}

// Monitor health tracking
const monitorHealth = new Map<string, MonitorHealth>();

// Retry configuration
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

export class FreeKioskClient {
  private baseUrl: string;
  private apiKey?: string;
  private ip: string;
  private port: number;
  private timeout = 5000; // 5 second timeout

  constructor(config: FreeKioskConfig) {
    this.ip = config.ip;
    this.port = config.port;
    this.baseUrl = `http://${config.ip}:${config.port}`;
    this.apiKey = config.apiKey;
  }

  private getHealthKey(): string {
    return `${this.ip}:${this.port}`;
  }

  private updateHealth(online: boolean): void {
    const key = this.getHealthKey();
    const existing = monitorHealth.get(key);
    const now = new Date();

    monitorHealth.set(key, {
      ip: this.ip,
      port: this.port,
      online,
      lastChecked: now,
      lastSeen: online ? now : existing?.lastSeen,
      consecutiveFailures: online ? 0 : (existing?.consecutiveFailures ?? 0) + 1
    });
  }

  private async request(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: Record<string, unknown>): Promise<FreeKioskResponse> {
    try {
      const url = new URL(`${this.baseUrl}${endpoint}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const headers: Record<string, string> = {};

      // Add API key if configured
      if (this.apiKey) {
        headers['X-Api-Key'] = this.apiKey;
      }

      // Add content type for POST with body (UTF-8 charset for Arabic support)
      if (method === 'POST' && body) {
        headers['Content-Type'] = 'application/json; charset=utf-8';
      }

      const response = await fetch(url.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      // FreeKiosk returns JSON
      const text = await response.text();
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }

      this.updateHealth(true);
      return { success: true, data };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[FreeKiosk] Request failed: ${endpoint}`, error);
      this.updateHealth(false);
      return { success: false, error };
    }
  }

  /**
   * Execute a request with retry logic
   */
  private async requestWithRetry(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: Record<string, unknown>,
    maxRetries: number = RETRY_ATTEMPTS
  ): Promise<FreeKioskResponse> {
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await this.request(endpoint, method, body);

      if (result.success) {
        return result;
      }

      lastError = result.error;

      if (attempt < maxRetries) {
        // Wait before retry with exponential backoff
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
      }
    }

    return { success: false, error: `Failed after ${maxRetries} attempts: ${lastError}` };
  }

  /**
   * Check if the device is reachable
   */
  async ping(): Promise<boolean> {
    const result = await this.request('/api/status');
    return result.success;
  }

  /**
   * Check health and return detailed status
   */
  async healthCheck(): Promise<MonitorHealth> {
    const online = await this.ping();
    return monitorHealth.get(this.getHealthKey()) || {
      ip: this.ip,
      port: this.port,
      online,
      lastChecked: new Date(),
      consecutiveFailures: online ? 0 : 1
    };
  }

  /**
   * Turn screen on
   */
  async screenOn(): Promise<FreeKioskResponse> {
    return this.request('/api/screen/on', 'POST');
  }

  /**
   * Turn screen off
   */
  async screenOff(): Promise<FreeKioskResponse> {
    return this.request('/api/screen/off', 'POST');
  }

  /**
   * Set screen brightness (0-100)
   */
  async setBrightness(level: number): Promise<FreeKioskResponse> {
    const brightness = Math.max(0, Math.min(100, level));
    return this.request('/api/brightness', 'POST', { value: brightness });
  }

  /**
   * Play a beep sound
   */
  async beep(): Promise<FreeKioskResponse> {
    return this.request('/api/audio/beep', 'POST');
  }

  /**
   * Play a beep sound with retry (for critical notifications)
   */
  async beepWithRetry(): Promise<FreeKioskResponse> {
    return this.requestWithRetry('/api/audio/beep', 'POST');
  }

  /**
   * Play text-to-speech
   * @param text - Text to speak
   * @param lang - Language code (e.g., 'ar', 'en'). Defaults to Arabic.
   */
  async speak(text: string, lang: string = 'ar'): Promise<FreeKioskResponse> {
    return this.request('/api/tts', 'POST', { text, lang });
  }

  /**
   * Play text-to-speech with retry (for critical notifications)
   */
  async speakWithRetry(text: string, lang: string = 'ar'): Promise<FreeKioskResponse> {
    return this.requestWithRetry('/api/tts', 'POST', { text, lang });
  }

  /**
   * Show toast notification on screen
   */
  async toast(text: string): Promise<FreeKioskResponse> {
    return this.request('/api/toast', 'POST', { text });
  }

  /**
   * Show toast notification with retry (for critical notifications)
   */
  async toastWithRetry(text: string): Promise<FreeKioskResponse> {
    return this.requestWithRetry('/api/toast', 'POST', { text });
  }

  /**
   * Show toast notification repeated multiple times (for longer visibility)
   * @param text - Text to display
   * @param repeat - Number of times to repeat (default 4)
   * @param delayMs - Delay between repeats in ms (default 2000)
   */
  async toastRepeated(text: string, repeat: number = 4, delayMs: number = 2000): Promise<void> {
    for (let i = 0; i < repeat; i++) {
      await this.request('/api/toast', 'POST', { text });
      if (i < repeat - 1) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }

  /**
   * Navigate to a URL in the kiosk browser
   */
  async loadUrl(url: string): Promise<FreeKioskResponse> {
    return this.request('/api/navigate', 'POST', { url });
  }

  /**
   * Get device status (battery, wifi, etc.)
   */
  async getStatus(): Promise<FreeKioskResponse> {
    return this.request('/api/status');
  }

  /**
   * Set volume (0-100)
   */
  async setVolume(level: number): Promise<FreeKioskResponse> {
    const volume = Math.max(0, Math.min(100, level));
    return this.request('/api/volume', 'POST', { value: volume });
  }
}

// Store active clients for reuse
const clients = new Map<string, FreeKioskClient>();

/**
 * Get or create a FreeKiosk client for a station
 */
export function getClient(ip: string, port: number = 8080): FreeKioskClient {
  const key = `${ip}:${port}`;

  if (!clients.has(key)) {
    clients.set(key, new FreeKioskClient({ ip, port }));
  }

  return clients.get(key)!;
}

/**
 * Send notification to a monitor when session starts
 * Uses retry for critical operations (beep, toast, speak)
 */
export async function notifySessionStart(ip: string, port: number, stationName: string, timerMinutes?: number): Promise<void> {
  const client = getClient(ip, port);

  // Turn on screen (best effort, no retry)
  await client.screenOn();
  await client.setBrightness(100);

  // Beep with retry for reliability
  await client.beepWithRetry();

  // Show toast (English) + speak (Arabic) with retry
  if (timerMinutes) {
    await client.toastWithRetry(`▶️ Session Started - ${timerMinutes} min`);
  } else {
    await client.toastWithRetry(`▶️ Session Started`);
  }
}

/**
 * Send notification to a monitor when timer is about to expire (warning)
 * Uses retry for critical operations
 */
export async function notifyTimerWarning(ip: string, port: number, minutesRemaining: number): Promise<void> {
  const client = getClient(ip, port);

  await client.beepWithRetry();
  await client.toastWithRetry(`⚠️ Warning: ${minutesRemaining} min remaining`);
}

/**
 * Send notification to a monitor when timer expires
 * Uses retry for critical operations - multiple beeps for urgency
 */
export async function notifyTimerExpired(ip: string, port: number, stationName: string): Promise<void> {
  const client = getClient(ip, port);

  // Multiple beeps for urgency (with retry on each)
  await client.beepWithRetry();
  await new Promise(r => setTimeout(r, 500));
  await client.beepWithRetry();
  await new Promise(r => setTimeout(r, 500));
  await client.beepWithRetry();

  // Show toast notification with retry (English)
  await client.toastWithRetry(`⏰ Time's Up!`);
}

/**
 * Send notification to a monitor when session ends
 * Uses retry for critical operations
 */
export async function notifySessionEnd(ip: string, port: number, stationName: string, turnOffScreen: boolean = true): Promise<void> {
  const client = getClient(ip, port);

  await client.beepWithRetry();
  await client.toastWithRetry(`⏹️ Session Ended`);

  if (turnOffScreen) {
    // Wait a bit for TTS to finish, then turn off screen
    await new Promise(r => setTimeout(r, 3000));
    await client.screenOff();
  }
}

/**
 * Test connection to a monitor
 */
export async function testConnection(ip: string, port: number): Promise<{ success: boolean; error?: string }> {
  const client = getClient(ip, port);

  const result = await client.ping();

  if (result) {
    // Play a test beep if connection successful
    await client.beep();
    return { success: true };
  }

  return { success: false, error: 'Could not connect to monitor' };
}
