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

export class FreeKioskClient {
  private baseUrl: string;
  private apiKey?: string;
  private timeout = 5000; // 5 second timeout

  constructor(config: FreeKioskConfig) {
    this.baseUrl = `http://${config.ip}:${config.port}`;
    this.apiKey = config.apiKey;
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

      // Add content type for POST with body
      if (method === 'POST' && body) {
        headers['Content-Type'] = 'application/json';
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

      return { success: true, data };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[FreeKiosk] Request failed: ${endpoint}`, error);
      return { success: false, error };
    }
  }

  /**
   * Check if the device is reachable
   */
  async ping(): Promise<boolean> {
    const result = await this.request('/api/status');
    return result.success;
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
   * Play text-to-speech
   */
  async speak(text: string): Promise<FreeKioskResponse> {
    return this.request('/api/tts', 'POST', { text });
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
 */
export async function notifySessionStart(ip: string, port: number, stationName: string, timerMinutes?: number): Promise<void> {
  const client = getClient(ip, port);

  // Turn on screen
  await client.screenOn();
  await client.setBrightness(200);

  // Beep and speak
  await client.beep();

  if (timerMinutes) {
    await client.speak(`بدأت الجلسة على ${stationName}، الوقت ${timerMinutes} دقيقة`);
  } else {
    await client.speak(`بدأت الجلسة على ${stationName}`);
  }
}

/**
 * Send notification to a monitor when timer is about to expire (warning)
 */
export async function notifyTimerWarning(ip: string, port: number, minutesRemaining: number): Promise<void> {
  const client = getClient(ip, port);

  await client.beep();
  await client.speak(`تنبيه: باقي ${minutesRemaining} دقيقة`);
}

/**
 * Send notification to a monitor when timer expires
 */
export async function notifyTimerExpired(ip: string, port: number, stationName: string): Promise<void> {
  const client = getClient(ip, port);

  // Multiple beeps for urgency
  await client.beep();
  await new Promise(r => setTimeout(r, 500));
  await client.beep();
  await new Promise(r => setTimeout(r, 500));
  await client.beep();

  // Loud notification
  await client.speak(`انتهى الوقت! انتهت الجلسة على ${stationName}`);
}

/**
 * Send notification to a monitor when session ends
 */
export async function notifySessionEnd(ip: string, port: number, stationName: string, turnOffScreen: boolean = true): Promise<void> {
  const client = getClient(ip, port);

  await client.beep();
  await client.speak(`انتهت الجلسة على ${stationName}`);

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
