/**
 * ADB Control Service
 *
 * Controls Android TV monitors via ADB over TCP (port 5555).
 * Supports different monitor types (TCL, Skyworth) with device-specific commands.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ADB port for TCP connections
const ADB_PORT = 5555;

// Command timeout in milliseconds
const COMMAND_TIMEOUT = 10000;

export interface AdbResult {
  success: boolean;
  output?: string;
  error?: string;
}

export type MonitorType = 'tcl' | 'skyworth';

/**
 * Execute an ADB command on a remote device
 */
export async function executeAdb(ip: string, command: string): Promise<AdbResult> {
  const target = `${ip}:${ADB_PORT}`;

  try {
    // First ensure we're connected
    await execAsync(`adb connect ${target}`, { timeout: COMMAND_TIMEOUT });

    // Execute the command
    const { stdout, stderr } = await execAsync(
      `adb -s ${target} shell ${command}`,
      { timeout: COMMAND_TIMEOUT }
    );

    return {
      success: true,
      output: stdout.trim(),
      error: stderr.trim() || undefined
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[ADB] Command failed on ${ip}: ${command}`, error);
    return {
      success: false,
      error
    };
  }
}

/**
 * Wake the screen (turn on display)
 * Uses keyevent 224 (KEYCODE_WAKEUP)
 */
export async function wakeScreen(ip: string): Promise<boolean> {
  console.log(`[ADB] Waking screen on ${ip}`);
  const result = await executeAdb(ip, 'input keyevent 224');
  return result.success;
}

/**
 * Put the screen to sleep (turn off display)
 * Uses keyevent 223 (KEYCODE_SLEEP)
 */
export async function sleepScreen(ip: string): Promise<boolean> {
  console.log(`[ADB] Sleeping screen on ${ip}`);
  const result = await executeAdb(ip, 'input keyevent 223');
  return result.success;
}

/**
 * Switch HDMI input based on monitor type
 *
 * @param ip - Monitor IP address
 * @param monitorType - 'tcl' or 'skyworth'
 * @param hdmiInput - HDMI input number (1-4)
 */
export async function switchHdmi(
  ip: string,
  monitorType: MonitorType,
  hdmiInput: number
): Promise<boolean> {
  console.log(`[ADB] Switching to HDMI ${hdmiInput} on ${ip} (${monitorType})`);

  if (monitorType === 'skyworth') {
    return switchHdmiSkyworth(ip, hdmiInput);
  } else {
    return switchHdmiTcl(ip, hdmiInput);
  }
}

/**
 * Switch HDMI input on Skyworth monitors
 * Uses keyevent 178 (SOURCE key) + navigation
 */
async function switchHdmiSkyworth(ip: string, hdmiInput: number): Promise<boolean> {
  // Press SOURCE key to open input selector
  let result = await executeAdb(ip, 'input keyevent 178');
  if (!result.success) return false;

  // Wait for menu to open
  await delay(500);

  // Navigate to the correct HDMI input
  // Assuming HDMI inputs are listed in order and we start at position 0
  // Press DOWN (hdmiInput - 1) times to reach the desired input
  for (let i = 0; i < hdmiInput; i++) {
    result = await executeAdb(ip, 'input keyevent 20'); // DPAD_DOWN
    if (!result.success) return false;
    await delay(200);
  }

  // Press ENTER to select
  result = await executeAdb(ip, 'input keyevent 66'); // ENTER
  return result.success;
}

/**
 * Switch HDMI input on TCL monitors
 * Uses source manager app + navigation
 */
async function switchHdmiTcl(ip: string, hdmiInput: number): Promise<boolean> {
  // Launch TCL source manager app
  let result = await executeAdb(
    ip,
    'am start -n com.tcl.sourcemananger/com.tcl.sourcemanager.MainActivity'
  );
  if (!result.success) return false;

  // Wait for app to open
  await delay(800);

  // Navigate to the correct HDMI input
  // TCL source manager: navigate right to HDMI section, then down to specific input
  // Press RIGHT to get to inputs section
  result = await executeAdb(ip, 'input keyevent 22'); // DPAD_RIGHT
  if (!result.success) return false;
  await delay(200);

  // Press DOWN (hdmiInput - 1) times to reach the desired input
  for (let i = 1; i < hdmiInput; i++) {
    result = await executeAdb(ip, 'input keyevent 20'); // DPAD_DOWN
    if (!result.success) return false;
    await delay(200);
  }

  // Press ENTER to select
  result = await executeAdb(ip, 'input keyevent 66'); // ENTER
  return result.success;
}

/**
 * Set WiFi sleep policy to NEVER (keeps WiFi on when screen is off)
 * This is important for TCL monitors which disconnect WiFi on screen off
 *
 * Values:
 * 0 = WIFI_SLEEP_POLICY_DEFAULT
 * 1 = WIFI_SLEEP_POLICY_NEVER_WHILE_PLUGGED
 * 2 = WIFI_SLEEP_POLICY_NEVER
 */
export async function setWifiSleepPolicy(ip: string): Promise<boolean> {
  console.log(`[ADB] Setting WiFi sleep policy to NEVER on ${ip}`);
  const result = await executeAdb(
    ip,
    'settings put global wifi_sleep_policy 2'
  );
  return result.success;
}

/**
 * Check if the device screen is on
 */
export async function isScreenOn(ip: string): Promise<boolean | null> {
  const result = await executeAdb(ip, 'dumpsys power | grep mWakefulness');
  if (!result.success || !result.output) return null;

  // mWakefulness=Awake means screen is on
  return result.output.includes('Awake');
}

/**
 * Send a key event to the device
 * Common key codes:
 * - 3: HOME
 * - 4: BACK
 * - 19: DPAD_UP
 * - 20: DPAD_DOWN
 * - 21: DPAD_LEFT
 * - 22: DPAD_RIGHT
 * - 23: DPAD_CENTER
 * - 66: ENTER
 * - 82: MENU
 * - 223: SLEEP
 * - 224: WAKEUP
 */
export async function sendKeyEvent(ip: string, keyCode: number): Promise<boolean> {
  const result = await executeAdb(ip, `input keyevent ${keyCode}`);
  return result.success;
}

/**
 * Test ADB connection to a device
 */
export async function testConnection(ip: string): Promise<AdbResult> {
  const target = `${ip}:${ADB_PORT}`;

  try {
    // Try to connect
    const { stdout: connectOut } = await execAsync(
      `adb connect ${target}`,
      { timeout: COMMAND_TIMEOUT }
    );

    // Check if connected
    const { stdout: devicesOut } = await execAsync(
      'adb devices',
      { timeout: COMMAND_TIMEOUT }
    );

    const isConnected = devicesOut.includes(target) && !devicesOut.includes('offline');

    if (isConnected) {
      // Try a simple command to verify
      const result = await executeAdb(ip, 'echo test');
      if (result.success) {
        return { success: true, output: 'Connected and responsive' };
      }
    }

    return {
      success: false,
      error: 'Device not responding',
      output: connectOut
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error };
  }
}

/**
 * Disconnect from a device
 */
export async function disconnect(ip: string): Promise<boolean> {
  const target = `${ip}:${ADB_PORT}`;
  try {
    await execAsync(`adb disconnect ${target}`, { timeout: COMMAND_TIMEOUT });
    return true;
  } catch {
    return false;
  }
}

/**
 * Install an APK on the device
 * @param ip - Device IP address
 * @param apkPath - Path to the APK file
 */
export async function installApk(ip: string, apkPath: string): Promise<AdbResult> {
  const target = `${ip}:${ADB_PORT}`;

  console.log(`[ADB] Installing APK on ${ip}: ${apkPath}`);

  try {
    // First ensure we're connected
    await execAsync(`adb connect ${target}`, { timeout: COMMAND_TIMEOUT });

    // Install the APK (use longer timeout for install over WiFi)
    const { stdout, stderr } = await execAsync(
      `adb -s ${target} install -r "${apkPath}"`,
      { timeout: 180000 } // 3 minute timeout for install over WiFi
    );

    const output = stdout.trim();
    const isSuccess = output.includes('Success');

    if (isSuccess) {
      console.log(`[ADB] APK installed successfully on ${ip}`);
      return { success: true, output };
    } else {
      console.error(`[ADB] APK install failed on ${ip}:`, output, stderr);
      return { success: false, error: stderr || output };
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[ADB] APK install error on ${ip}:`, error);
    return { success: false, error };
  }
}

/**
 * Check if an app is installed on the device
 * @param ip - Device IP address
 * @param packageName - Package name to check (e.g., 'nl.rogro82.pipup')
 */
export async function isAppInstalled(ip: string, packageName: string): Promise<boolean> {
  const target = `${ip}:${ADB_PORT}`;

  try {
    // Ensure connected
    await execAsync(`adb connect ${target}`, { timeout: COMMAND_TIMEOUT });

    // Run pm list packages and grep on the device (use quotes to run pipe on device)
    const { stdout } = await execAsync(
      `adb -s ${target} shell "pm list packages | grep ${packageName}"`,
      { timeout: COMMAND_TIMEOUT }
    );

    return stdout.includes(packageName);
  } catch {
    // grep returns exit code 1 if no match, which throws an error
    return false;
  }
}

/**
 * Launch an app on the device
 * @param ip - Device IP address
 * @param packageName - Package name to launch
 */
export async function launchApp(ip: string, packageName: string): Promise<boolean> {
  // Use am start which is more reliable on Android TV than monkey
  // For PiPup specifically, we know the main activity
  const activity = packageName === 'nl.rogro82.pipup'
    ? `${packageName}/.MainActivity`
    : `${packageName}/.MainActivity`; // Default assumption

  const result = await executeAdb(ip, `am start -n ${activity}`);

  // Check if launch was successful
  if (result.success && !result.output?.includes('Error') && !result.output?.includes('Exception')) {
    return true;
  }

  // Fallback to monkey command if am start fails
  const monkeyResult = await executeAdb(
    ip,
    `monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`
  );
  return monkeyResult.success;
}

/**
 * Wait for ADB authorization (user must press Allow on TV)
 * Polls the connection until authorized or timeout
 * @param ip - Device IP address
 * @param timeoutMs - Maximum time to wait (default 60 seconds)
 * @param pollIntervalMs - How often to check (default 2 seconds)
 */
export async function waitForAuthorization(
  ip: string,
  timeoutMs: number = 60000,
  pollIntervalMs: number = 2000
): Promise<AdbResult> {
  const target = `${ip}:${ADB_PORT}`;
  const startTime = Date.now();

  console.log(`[ADB] Waiting for authorization on ${ip}...`);

  // Initial connect attempt
  try {
    await execAsync(`adb connect ${target}`, { timeout: COMMAND_TIMEOUT });
  } catch {
    // Ignore initial connect errors
  }

  while (Date.now() - startTime < timeoutMs) {
    try {
      // Check device status
      const { stdout } = await execAsync('adb devices', { timeout: COMMAND_TIMEOUT });

      if (stdout.includes(target)) {
        // Check if it's authorized (not showing as 'unauthorized' or 'offline')
        if (!stdout.includes('unauthorized') && !stdout.includes('offline')) {
          // Try a simple command to verify
          const testResult = await executeAdb(ip, 'echo authorized');
          if (testResult.success) {
            console.log(`[ADB] Device ${ip} authorized!`);
            return { success: true, output: 'Device authorized' };
          }
        }
      }

      // Not yet authorized, wait and retry
      await delay(pollIntervalMs);

      // Try connecting again
      await execAsync(`adb connect ${target}`, { timeout: COMMAND_TIMEOUT }).catch(() => {});

    } catch {
      // Ignore errors, keep polling
      await delay(pollIntervalMs);
    }
  }

  return { success: false, error: 'Authorization timeout - user did not allow ADB access' };
}

/**
 * Helper function to delay execution
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
