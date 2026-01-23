/**
 * PiPup Notification Service
 *
 * Sends popup notifications to Android TV monitors via PiPup app (port 7979).
 * PiPup displays overlay notifications on top of any running app.
 *
 * Note: Device fonts may not support Arabic or emoji.
 * Use English text with ASCII symbols like [>], [!], [X].
 */

// PiPup default port
const PIPUP_PORT = 7979;

// Request timeout in milliseconds
const REQUEST_TIMEOUT = 5000;

/**
 * Notification position options
 * 0 = Top Right (default)
 * 1 = Top Left
 * 2 = Bottom Right
 * 3 = Bottom Left
 * 4 = Center
 */
export type NotificationPosition = 0 | 1 | 2 | 3 | 4;

export interface NotificationOptions {
  duration?: number;           // Duration in seconds (default: 8)
  position?: NotificationPosition; // Position on screen (default: 0 = top-right)
  title?: string;              // Notification title
  titleSize?: number;          // Title font size (default: 20)
  titleColor?: string;         // Title color hex (default: #FFFFFF)
  message?: string;            // Notification message
  messageSize?: number;        // Message font size (default: 14)
  messageColor?: string;       // Message color hex (default: #FFFFFF)
  backgroundColor?: string;    // Background color hex (default: #000000CC)
}

export interface PipupResult {
  success: boolean;
  error?: string;
}

/**
 * Send a notification to a PiPup-enabled monitor
 */
export async function sendNotification(
  ip: string,
  options: NotificationOptions
): Promise<PipupResult> {
  const url = `http://${ip}:${PIPUP_PORT}/notify`;

  const payload = {
    duration: options.duration ?? 8,
    position: options.position ?? 0, // Top right
    title: options.title ?? '',
    titleSize: options.titleSize ?? 20,
    titleColor: options.titleColor ?? '#FFFFFF',
    message: options.message ?? '',
    messageSize: options.messageSize ?? 14,
    messageColor: options.messageColor ?? '#FFFFFF',
    backgroundColor: options.backgroundColor ?? '#000000CC'
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[PiPup] Notification failed to ${ip}:`, error);
    return { success: false, error };
  }
}

/**
 * Send a session start notification
 */
export async function notifySessionStart(
  ip: string,
  stationName: string,
  timerMinutes?: number
): Promise<PipupResult> {
  const message = timerMinutes
    ? `Timer: ${timerMinutes} minutes`
    : 'Open session - no timer';

  return sendNotification(ip, {
    duration: 10,
    position: 0,
    title: '[>] Session Started',
    titleSize: 24,
    titleColor: '#4ADE80', // Green
    message,
    messageSize: 18,
    messageColor: '#FFFFFF',
    backgroundColor: '#1F2937E6' // Dark gray with transparency
  });
}

/**
 * Send a timer warning notification (e.g., 5 minutes remaining)
 */
export async function notifyTimerWarning(
  ip: string,
  minutesRemaining: number
): Promise<PipupResult> {
  return sendNotification(ip, {
    duration: 12,
    position: 0,
    title: '[!] Time Warning',
    titleSize: 24,
    titleColor: '#FBBF24', // Yellow/amber
    message: `${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''} remaining!`,
    messageSize: 20,
    messageColor: '#FFFFFF',
    backgroundColor: '#78350FE6' // Dark amber with transparency
  });
}

/**
 * Send a timer expired notification
 */
export async function notifyTimerExpired(
  ip: string,
  stationName: string
): Promise<PipupResult> {
  return sendNotification(ip, {
    duration: 15,
    position: 0,
    title: '[X] Time Up!',
    titleSize: 28,
    titleColor: '#F87171', // Red
    message: 'Session timer has expired',
    messageSize: 20,
    messageColor: '#FFFFFF',
    backgroundColor: '#7F1D1DE6' // Dark red with transparency
  });
}

/**
 * Send a session end notification
 */
export async function notifySessionEnd(
  ip: string,
  stationName: string
): Promise<PipupResult> {
  return sendNotification(ip, {
    duration: 8,
    position: 0,
    title: '[=] Session Ended',
    titleSize: 24,
    titleColor: '#60A5FA', // Blue
    message: 'Thank you for playing!',
    messageSize: 18,
    messageColor: '#FFFFFF',
    backgroundColor: '#1E3A8AE6' // Dark blue with transparency
  });
}

/**
 * Send a custom notification with a predefined style
 */
export async function notifyInfo(
  ip: string,
  title: string,
  message: string
): Promise<PipupResult> {
  return sendNotification(ip, {
    duration: 8,
    position: 0,
    title,
    titleSize: 22,
    titleColor: '#38BDF8', // Sky blue
    message,
    messageSize: 16,
    messageColor: '#FFFFFF',
    backgroundColor: '#0F172AE6' // Slate with transparency
  });
}

/**
 * Send a success notification
 */
export async function notifySuccess(
  ip: string,
  title: string,
  message: string
): Promise<PipupResult> {
  return sendNotification(ip, {
    duration: 8,
    position: 0,
    title,
    titleSize: 22,
    titleColor: '#4ADE80', // Green
    message,
    messageSize: 16,
    messageColor: '#FFFFFF',
    backgroundColor: '#14532DE6' // Dark green with transparency
  });
}

/**
 * Send an error/alert notification
 */
export async function notifyError(
  ip: string,
  title: string,
  message: string
): Promise<PipupResult> {
  return sendNotification(ip, {
    duration: 10,
    position: 0,
    title,
    titleSize: 22,
    titleColor: '#F87171', // Red
    message,
    messageSize: 16,
    messageColor: '#FFFFFF',
    backgroundColor: '#7F1D1DE6' // Dark red with transparency
  });
}

/**
 * Test PiPup connection by sending a test notification
 */
export async function testConnection(ip: string): Promise<PipupResult> {
  return sendNotification(ip, {
    duration: 5,
    position: 0,
    title: '[OK] Connection Test',
    titleSize: 22,
    titleColor: '#4ADE80',
    message: 'PiPup is working!',
    messageSize: 16,
    messageColor: '#FFFFFF',
    backgroundColor: '#1F2937E6'
  });
}
