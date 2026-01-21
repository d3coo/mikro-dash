import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as freekiosk from '$lib/server/services/freekiosk';

/**
 * POST /api/playstation/kiosk
 * Control FreeKiosk Android monitors
 *
 * Body: { action, ip, port, ...params }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { action, ip, port = 8080, ...params } = body;

    if (!ip) {
      return json({ success: false, error: 'IP address is required' }, { status: 400 });
    }

    const client = freekiosk.getClient(ip, port);

    switch (action) {
      case 'test':
        // Test connection and play beep
        const testResult = await freekiosk.testConnection(ip, port);
        return json(testResult);

      case 'screen_on':
        await client.screenOn();
        return json({ success: true });

      case 'screen_off':
        await client.screenOff();
        return json({ success: true });

      case 'brightness':
        const level = params.level ?? 200;
        await client.setBrightness(level);
        return json({ success: true });

      case 'beep':
        await client.beep();
        return json({ success: true });

      case 'speak':
        if (!params.text) {
          return json({ success: false, error: 'Text is required for speak action' }, { status: 400 });
        }
        await client.speak(params.text, params.lang || 'ar');
        return json({ success: true });

      case 'status':
        const status = await client.getStatus();
        return json(status);

      case 'session_start':
        // Full session start notification
        await freekiosk.notifySessionStart(ip, port, params.stationName || 'Station', params.timerMinutes);
        return json({ success: true });

      case 'session_end':
        // Full session end notification
        await freekiosk.notifySessionEnd(ip, port, params.stationName || 'Station', params.turnOffScreen ?? true);
        return json({ success: true });

      case 'timer_warning':
        // Timer warning notification
        await freekiosk.notifyTimerWarning(ip, port, params.minutesRemaining ?? 5);
        return json({ success: true });

      case 'timer_expired':
        // Timer expired notification
        await freekiosk.notifyTimerExpired(ip, port, params.stationName || 'Station');
        return json({ success: true });

      default:
        return json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error('[Kiosk API] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return json({ success: false, error: message }, { status: 500 });
  }
};
