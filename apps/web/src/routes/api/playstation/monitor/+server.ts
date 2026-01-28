import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStationById } from '$lib/server/services/playstation';
import * as monitorControl from '$lib/server/services/monitor-control';
import * as adb from '$lib/server/services/adb-control';
import * as pipup from '$lib/server/services/pipup';
import { resolve } from 'path';
import { getMikroTikClient } from '$lib/server/services/mikrotik';

// Path to PiPup APK (in static folder, copied to build)
const PIPUP_APK_PATH = resolve(process.cwd(), 'static', 'apk', 'PiPup.apk');

/**
 * POST /api/playstation/monitor
 * Unified monitor control API
 *
 * Body: { action, stationId?, ip?, ...params }
 *
 * Actions:
 * - timer_warning: Send timer warning notification
 * - timer_expired: Send timer expired notification (+ screen off if configured)
 * - session_start: Full session start flow (wake, HDMI, notify)
 * - session_end: Full session end flow (notify, screen off if configured)
 * - screen_on: Wake screen via ADB
 * - screen_off: Sleep screen via ADB
 * - hdmi_switch: Switch HDMI input via ADB
 * - notify: Send custom PiPup notification
 * - test_adb: Test ADB connection
 * - test_pipup: Test PiPup connection
 * - test_all: Test both connections
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { action, stationId, ip, ...params } = body;

    // Get station if stationId provided
    let station = stationId ? getStationById(stationId) : null;

    // If no station but IP provided, create a minimal station object
    if (!station && ip) {
      station = {
        id: 'temp',
        name: 'Temp',
        nameAr: params.stationName || 'Station',
        macAddress: '',
        hourlyRate: 0,
        hourlyRateMulti: null,
        status: 'available',
        monitorIp: ip,
        monitorPort: params.port || 8080,
        monitorType: params.monitorType || 'tcl',
        timerEndAction: params.timerEndAction || 'notify',
        hdmiInput: params.hdmiInput || 2,
        sortOrder: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    }

    if (!station?.monitorIp && !ip) {
      return json({ success: false, error: 'Station ID or IP address is required' }, { status: 400 });
    }

    const targetIp = station?.monitorIp || ip;

    switch (action) {
      // Timer events (called from client-side timer)
      case 'timer_warning': {
        if (!station) {
          return json({ success: false, error: 'Station not found' }, { status: 404 });
        }
        const minutesRemaining = params.minutesRemaining ?? 5;
        const result = await monitorControl.onTimerWarning(station, minutesRemaining);
        return json(result);
      }

      case 'timer_expired': {
        if (!station) {
          return json({ success: false, error: 'Station not found' }, { status: 404 });
        }
        const result = await monitorControl.onTimerExpired(station);
        return json(result);
      }

      // Session events (can also be called directly)
      case 'session_start': {
        if (!station) {
          return json({ success: false, error: 'Station not found' }, { status: 404 });
        }
        const timerMinutes = params.timerMinutes ? parseInt(params.timerMinutes, 10) : undefined;
        const result = await monitorControl.onSessionStart(station, timerMinutes);
        return json(result);
      }

      case 'session_end': {
        if (!station) {
          return json({ success: false, error: 'Station not found' }, { status: 404 });
        }
        const result = await monitorControl.onSessionEnd(station);
        return json(result);
      }

      // Direct ADB controls
      case 'screen_on': {
        const result = await adb.wakeScreen(targetIp);
        return json({ success: result });
      }

      case 'screen_off': {
        const result = await adb.sleepScreen(targetIp);
        return json({ success: result });
      }

      case 'hdmi_switch': {
        const monitorType = (params.monitorType || station?.monitorType || 'tcl') as 'tcl' | 'skyworth';
        const hdmiInput = params.hdmiInput || station?.hdmiInput || 2;
        const result = await adb.switchHdmi(targetIp, monitorType, hdmiInput);
        return json({ success: result });
      }

      // Direct PiPup notification
      case 'notify': {
        if (!params.title && !params.message) {
          return json({ success: false, error: 'Title or message is required' }, { status: 400 });
        }
        const result = await pipup.sendNotification(targetIp, {
          title: params.title,
          message: params.message,
          duration: params.duration,
          position: params.position,
          titleSize: params.titleSize,
          titleColor: params.titleColor,
          messageSize: params.messageSize,
          messageColor: params.messageColor,
          backgroundColor: params.backgroundColor
        });
        return json(result);
      }

      // Connection tests
      case 'test_adb': {
        const result = await adb.testConnection(targetIp);
        return json(result);
      }

      case 'test_pipup': {
        const result = await pipup.testConnection(targetIp);
        return json(result);
      }

      case 'test_all': {
        if (!station) {
          // Create minimal station for testing
          station = {
            id: 'test',
            name: 'Test',
            nameAr: 'Test',
            macAddress: '',
            hourlyRate: 0,
            hourlyRateMulti: null,
            status: 'available',
            monitorIp: targetIp,
            monitorPort: 8080,
            monitorType: 'tcl',
            timerEndAction: 'notify',
            hdmiInput: 2,
            sortOrder: 0,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
        }
        const result = await monitorControl.testConnections(station!);
        return json({
          success: result.adb.success || result.pipup.success,
          adb: result.adb,
          pipup: result.pipup
        });
      }

      // ===== SETUP WIZARD ACTIONS =====

      // Step 1: Connect ADB and wait for authorization
      case 'setup_adb_connect': {
        // First try to connect
        try {
          await adb.testConnection(targetIp);
        } catch {
          // Ignore initial connect error
        }
        return json({
          success: true,
          message: 'ADB connection initiated. Please press ALLOW on the TV screen.'
        });
      }

      // Step 2: Wait for ADB authorization (poll until authorized)
      case 'setup_adb_wait': {
        const timeoutMs = params.timeout || 60000;
        const result = await adb.waitForAuthorization(targetIp, timeoutMs);
        return json(result);
      }

      // Step 3: Install PiPup APK
      case 'setup_install_pipup': {
        // Check if already installed
        const isInstalled = await adb.isAppInstalled(targetIp, 'nl.rogro82.pipup');
        if (isInstalled) {
          return json({ success: true, output: 'PiPup is already installed' });
        }

        // Install the APK
        const result = await adb.installApk(targetIp, PIPUP_APK_PATH);
        return json(result);
      }

      // Step 4: Launch PiPup app (needed for first-time setup)
      case 'setup_launch_pipup': {
        const launched = await adb.launchApp(targetIp, 'nl.rogro82.pipup');
        if (launched) {
          // Wait for the app to fully start and bind to port
          await new Promise(r => setTimeout(r, 5000));
          return json({ success: true, output: 'PiPup launched' });
        }
        return json({ success: false, error: 'Failed to launch PiPup' });
      }

      // Step 5: Test PiPup notification (already exists as test_pipup)
      // Step 6: Test HDMI switch
      case 'setup_test_hdmi': {
        const monitorType = (params.monitorType || 'tcl') as 'tcl' | 'skyworth';
        const hdmiInput = params.hdmiInput || 2;
        const result = await adb.switchHdmi(targetIp, monitorType, hdmiInput);
        return json({ success: result });
      }

      // Step 7: Test screen off
      case 'setup_test_screen_off': {
        const result = await adb.sleepScreen(targetIp);
        return json({ success: result });
      }

      // Full setup sequence (runs all steps)
      case 'setup_full': {
        const monitorType = (params.monitorType || 'tcl') as 'tcl' | 'skyworth';
        const hdmiInput = params.hdmiInput || 2;
        const results: Record<string, any> = {};

        // Step 1: Wait for ADB authorization
        results.adb = await adb.waitForAuthorization(targetIp, 60000);
        if (!results.adb.success) {
          return json({ success: false, step: 'adb', error: results.adb.error, results });
        }

        // Step 2: Install PiPup
        const isInstalled = await adb.isAppInstalled(targetIp, 'nl.rogro82.pipup');
        if (!isInstalled) {
          results.install = await adb.installApk(targetIp, PIPUP_APK_PATH);
          if (!results.install.success) {
            return json({ success: false, step: 'install', error: results.install.error, results });
          }
        } else {
          results.install = { success: true, output: 'Already installed' };
        }

        // Step 3: Launch PiPup
        await adb.launchApp(targetIp, 'nl.rogro82.pipup');
        await new Promise(r => setTimeout(r, 2000));
        results.launch = { success: true };

        // Step 4: Test PiPup notification
        results.pipup = await pipup.testConnection(targetIp);
        if (!results.pipup.success) {
          return json({ success: false, step: 'pipup', error: results.pipup.error, results });
        }

        // Step 5: Test HDMI switch
        results.hdmi = { success: await adb.switchHdmi(targetIp, monitorType, hdmiInput) };

        // Step 6: Test screen off
        results.screenOff = { success: await adb.sleepScreen(targetIp) };

        return json({ success: true, results });
      }

      // ===== MIKROTIK NETWORK SETUP =====

      // Setup network: Add IP binding (bypass hotspot) + firewall rule (block internet)
      case 'setup_network': {
        try {
          const client = getMikroTikClient();
          const comment = `Monitor ${targetIp}`;

          // Step 1: Add IP binding to bypass hotspot
          // First check if already exists
          const bindings = await client.getIpBindings();
          const existingBinding = bindings.find(b => b.address === targetIp);

          if (!existingBinding) {
            await client.addIpBindingByAddress(targetIp, 'bypassed', comment);
            console.log(`[Monitor API] Added IP binding for ${targetIp}`);
          } else {
            console.log(`[Monitor API] IP binding already exists for ${targetIp}`);
          }

          // Step 2: Add firewall rule to block internet
          // First check if already exists
          const rules = await client.getFirewallFilterRules();
          const existingRule = rules.find(r =>
            r['src-address'] === targetIp &&
            r.chain === 'forward' &&
            r.action === 'drop'
          );

          if (!existingRule) {
            await client.addFirewallFilterRule({
              chain: 'forward',
              action: 'drop',
              srcAddress: targetIp,
              comment
            });
            console.log(`[Monitor API] Added firewall rule for ${targetIp}`);
          } else {
            console.log(`[Monitor API] Firewall rule already exists for ${targetIp}`);
          }

          return json({
            success: true,
            message: 'Network setup complete',
            binding: existingBinding ? 'exists' : 'added',
            firewall: existingRule ? 'exists' : 'added'
          });
        } catch (err) {
          const error = err instanceof Error ? err.message : 'Unknown error';
          console.error('[Monitor API] Network setup failed:', error);
          return json({ success: false, error }, { status: 500 });
        }
      }

      // Check network setup status
      case 'check_network': {
        try {
          const client = getMikroTikClient();

          const bindings = await client.getIpBindings();
          const hasBinding = bindings.some(b => b.address === targetIp && b.type === 'bypassed');

          const rules = await client.getFirewallFilterRules();
          const hasFirewall = rules.some(r =>
            r['src-address'] === targetIp &&
            r.chain === 'forward' &&
            r.action === 'drop'
          );

          return json({
            success: true,
            binding: hasBinding,
            firewall: hasFirewall,
            ready: hasBinding && hasFirewall
          });
        } catch (err) {
          const error = err instanceof Error ? err.message : 'Unknown error';
          return json({ success: false, error }, { status: 500 });
        }
      }

      // Remove network setup (cleanup)
      case 'remove_network': {
        try {
          const client = getMikroTikClient();

          // Remove IP binding
          const bindings = await client.getIpBindings();
          const binding = bindings.find(b => b.address === targetIp);
          if (binding) {
            await client.removeIpBinding(binding['.id']);
            console.log(`[Monitor API] Removed IP binding for ${targetIp}`);
          }

          // Remove firewall rule
          const rules = await client.getFirewallFilterRules();
          const rule = rules.find(r =>
            r['src-address'] === targetIp &&
            r.chain === 'forward' &&
            r.action === 'drop'
          );
          if (rule) {
            await client.removeFirewallFilterRule(rule['.id']);
            console.log(`[Monitor API] Removed firewall rule for ${targetIp}`);
          }

          return json({ success: true, message: 'Network setup removed' });
        } catch (err) {
          const error = err instanceof Error ? err.message : 'Unknown error';
          return json({ success: false, error }, { status: 500 });
        }
      }

      default:
        return json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error('[Monitor API] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return json({ success: false, error: message }, { status: 500 });
  }
};
