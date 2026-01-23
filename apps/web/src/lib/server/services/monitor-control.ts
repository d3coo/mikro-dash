/**
 * Unified Monitor Control Service
 *
 * Orchestrates ADB (screen control, HDMI switching) and PiPup (notifications)
 * for PlayStation station monitors.
 *
 * Handles different monitor types (TCL, Skyworth) and per-station timer-end behavior.
 */

import * as adb from './adb-control';
import * as pipup from './pipup';
import type { MonitorType } from './adb-control';

export interface Station {
  id: string;
  name: string;
  nameAr: string;
  monitorIp: string | null;
  monitorPort: number | null;
  monitorType: string | null;      // 'tcl' | 'skyworth'
  timerEndAction: string | null;   // 'notify' | 'screen_off'
  hdmiInput: number | null;        // 1-4
}

export interface MonitorControlResult {
  success: boolean;
  adbResult?: boolean;
  pipupResult?: boolean;
  error?: string;
}

/**
 * Get default values for optional station fields
 */
function getMonitorType(station: Station): MonitorType {
  return (station.monitorType as MonitorType) || 'tcl';
}

function getTimerEndAction(station: Station): 'notify' | 'screen_off' {
  return (station.timerEndAction as 'notify' | 'screen_off') || 'notify';
}

function getHdmiInput(station: Station): number {
  return station.hdmiInput ?? 2;
}

/**
 * Called when a session starts
 * 1. Wake screen via ADB
 * 2. Switch to PS HDMI input
 * 3. Send start notification via PiPup
 */
export async function onSessionStart(
  station: Station,
  timerMinutes?: number
): Promise<MonitorControlResult> {
  if (!station.monitorIp) {
    return { success: true }; // No monitor configured, skip
  }

  const ip = station.monitorIp;
  const monitorType = getMonitorType(station);
  const hdmiInput = getHdmiInput(station);

  console.log(`[MonitorControl] Session start for ${station.id} (${ip}, ${monitorType}, HDMI ${hdmiInput})`);

  let adbSuccess = true;
  let pipupSuccess = true;

  try {
    // 1. Wake screen
    const wakeResult = await adb.wakeScreen(ip);
    if (!wakeResult) {
      console.warn(`[MonitorControl] Failed to wake screen for ${station.id}`);
    }

    // Wait for screen to wake
    await delay(1000);

    // 2. Switch HDMI input
    const hdmiResult = await adb.switchHdmi(ip, monitorType, hdmiInput);
    if (!hdmiResult) {
      console.warn(`[MonitorControl] Failed to switch HDMI for ${station.id}`);
    }

    adbSuccess = wakeResult && hdmiResult;

    // Wait for HDMI switch
    await delay(500);

    // 3. Send notification via PiPup
    const notifyResult = await pipup.notifySessionStart(ip, station.nameAr, timerMinutes);
    pipupSuccess = notifyResult.success;

    if (!pipupSuccess) {
      console.warn(`[MonitorControl] PiPup notification failed for ${station.id}:`, notifyResult.error);
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[MonitorControl] Session start error for ${station.id}:`, error);
    return { success: false, error };
  }

  return {
    success: adbSuccess || pipupSuccess, // Success if at least one worked
    adbResult: adbSuccess,
    pipupResult: pipupSuccess
  };
}

/**
 * Called when timer warning is triggered (e.g., 5 minutes remaining)
 * Send warning notification via PiPup
 */
export async function onTimerWarning(
  station: Station,
  minutesRemaining: number
): Promise<MonitorControlResult> {
  if (!station.monitorIp) {
    return { success: true }; // No monitor configured, skip
  }

  const ip = station.monitorIp;

  console.log(`[MonitorControl] Timer warning for ${station.id}: ${minutesRemaining} min remaining`);

  try {
    const notifyResult = await pipup.notifyTimerWarning(ip, minutesRemaining);

    return {
      success: notifyResult.success,
      pipupResult: notifyResult.success,
      error: notifyResult.error
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[MonitorControl] Timer warning error for ${station.id}:`, error);
    return { success: false, error };
  }
}

/**
 * Called when timer expires
 * 1. Send expired notification via PiPup
 * 2. If timerEndAction === 'screen_off': sleep screen via ADB
 */
export async function onTimerExpired(station: Station): Promise<MonitorControlResult> {
  if (!station.monitorIp) {
    return { success: true }; // No monitor configured, skip
  }

  const ip = station.monitorIp;
  const timerEndAction = getTimerEndAction(station);

  console.log(`[MonitorControl] Timer expired for ${station.id} (action: ${timerEndAction})`);

  let adbSuccess = true;
  let pipupSuccess = true;

  try {
    // 1. Send expired notification
    const notifyResult = await pipup.notifyTimerExpired(ip, station.nameAr);
    pipupSuccess = notifyResult.success;

    if (!pipupSuccess) {
      console.warn(`[MonitorControl] PiPup notification failed for ${station.id}:`, notifyResult.error);
    }

    // 2. Turn off screen if configured
    if (timerEndAction === 'screen_off') {
      // Wait for notification to be seen
      await delay(3000);

      const sleepResult = await adb.sleepScreen(ip);
      adbSuccess = sleepResult;

      if (!adbSuccess) {
        console.warn(`[MonitorControl] Failed to sleep screen for ${station.id}`);
      }
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[MonitorControl] Timer expired error for ${station.id}:`, error);
    return { success: false, error };
  }

  return {
    success: pipupSuccess || adbSuccess,
    adbResult: adbSuccess,
    pipupResult: pipupSuccess
  };
}

/**
 * Called when a session ends
 * 1. Send end notification via PiPup
 * 2. If timerEndAction === 'screen_off': sleep screen via ADB
 */
export async function onSessionEnd(station: Station): Promise<MonitorControlResult> {
  if (!station.monitorIp) {
    return { success: true }; // No monitor configured, skip
  }

  const ip = station.monitorIp;
  const timerEndAction = getTimerEndAction(station);

  console.log(`[MonitorControl] Session end for ${station.id} (action: ${timerEndAction})`);

  let adbSuccess = true;
  let pipupSuccess = true;

  try {
    // 1. Send end notification
    const notifyResult = await pipup.notifySessionEnd(ip, station.nameAr);
    pipupSuccess = notifyResult.success;

    if (!pipupSuccess) {
      console.warn(`[MonitorControl] PiPup notification failed for ${station.id}:`, notifyResult.error);
    }

    // 2. Turn off screen if configured
    if (timerEndAction === 'screen_off') {
      // Wait for notification to be seen
      await delay(3000);

      const sleepResult = await adb.sleepScreen(ip);
      adbSuccess = sleepResult;

      if (!adbSuccess) {
        console.warn(`[MonitorControl] Failed to sleep screen for ${station.id}`);
      }
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[MonitorControl] Session end error for ${station.id}:`, error);
    return { success: false, error };
  }

  return {
    success: pipupSuccess || adbSuccess,
    adbResult: adbSuccess,
    pipupResult: pipupSuccess
  };
}

/**
 * Direct control: Wake screen
 */
export async function wakeScreen(station: Station): Promise<MonitorControlResult> {
  if (!station.monitorIp) {
    return { success: false, error: 'No monitor IP configured' };
  }

  const result = await adb.wakeScreen(station.monitorIp);
  return { success: result, adbResult: result };
}

/**
 * Direct control: Sleep screen
 */
export async function sleepScreen(station: Station): Promise<MonitorControlResult> {
  if (!station.monitorIp) {
    return { success: false, error: 'No monitor IP configured' };
  }

  const result = await adb.sleepScreen(station.monitorIp);
  return { success: result, adbResult: result };
}

/**
 * Direct control: Switch HDMI
 */
export async function switchHdmi(station: Station): Promise<MonitorControlResult> {
  if (!station.monitorIp) {
    return { success: false, error: 'No monitor IP configured' };
  }

  const monitorType = getMonitorType(station);
  const hdmiInput = getHdmiInput(station);

  const result = await adb.switchHdmi(station.monitorIp, monitorType, hdmiInput);
  return { success: result, adbResult: result };
}

/**
 * Direct control: Send custom notification
 */
export async function sendNotification(
  station: Station,
  title: string,
  message: string
): Promise<MonitorControlResult> {
  if (!station.monitorIp) {
    return { success: false, error: 'No monitor IP configured' };
  }

  const result = await pipup.notifyInfo(station.monitorIp, title, message);
  return { success: result.success, pipupResult: result.success, error: result.error };
}

/**
 * Test both ADB and PiPup connections
 */
export async function testConnections(station: Station): Promise<{
  adb: { success: boolean; error?: string };
  pipup: { success: boolean; error?: string };
}> {
  if (!station.monitorIp) {
    return {
      adb: { success: false, error: 'No monitor IP configured' },
      pipup: { success: false, error: 'No monitor IP configured' }
    };
  }

  const ip = station.monitorIp;

  // Test in parallel
  const [adbResult, pipupResult] = await Promise.all([
    adb.testConnection(ip),
    pipup.testConnection(ip)
  ]);

  return {
    adb: { success: adbResult.success, error: adbResult.error },
    pipup: { success: pipupResult.success, error: pipupResult.error }
  };
}

/**
 * Helper function to delay execution
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
