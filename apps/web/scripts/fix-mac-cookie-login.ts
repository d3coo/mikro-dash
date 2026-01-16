/**
 * Fix: Add mac-cookie to login-by methods on hotspot server profiles
 * This enables automatic re-authentication based on device MAC address
 */

const ROUTER_HOST = '192.168.1.109';
const ROUTER_USER = 'admin';
const ROUTER_PASS = 'need4speed';

const baseUrl = `http://${ROUTER_HOST}/rest`;
const authHeader = 'Basic ' + Buffer.from(`${ROUTER_USER}:${ROUTER_PASS}`).toString('base64');

async function request<T>(endpoint: string, method: 'GET' | 'PATCH' = 'GET', body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`MikroTik API error: ${response.status} - ${error}`);
  }

  return response.json();
}

interface ServerProfile {
  '.id': string;
  name: string;
  'login-by'?: string;
  'http-cookie-lifetime'?: string;
}

async function main() {
  console.log('=== FIXING MAC-COOKIE LOGIN ===\n');

  // Get hotspot server profiles
  const profiles = await request<ServerProfile[]>('/ip/hotspot/profile');

  console.log('Current server profiles:\n');
  for (const p of profiles) {
    console.log(`  ${p.name}:`);
    console.log(`    login-by: ${p['login-by'] || 'default'}`);
  }

  console.log('\n--- Updating profiles to include mac-cookie ---\n');

  for (const profile of profiles) {
    const currentLoginBy = profile['login-by'] || '';

    // Check if mac-cookie is already included
    if (currentLoginBy.includes('mac-cookie')) {
      console.log(`  ✓ "${profile.name}" already has mac-cookie`);
      continue;
    }

    // Add mac-cookie at the beginning (highest priority)
    // mac-cookie should come before cookie and other methods
    let newLoginBy: string;

    if (currentLoginBy) {
      // Insert mac-cookie at the start for highest priority
      const methods = currentLoginBy.split(',').map(m => m.trim());
      if (!methods.includes('mac-cookie')) {
        methods.unshift('mac-cookie');
      }
      newLoginBy = methods.join(',');
    } else {
      newLoginBy = 'mac-cookie,cookie,http-chap';
    }

    try {
      await request(`/ip/hotspot/profile/${profile['.id']}`, 'PATCH', {
        'login-by': newLoginBy
      });
      console.log(`  ✓ Updated "${profile.name}": login-by = ${newLoginBy}`);
    } catch (error) {
      console.error(`  ✗ Failed to update "${profile.name}":`, error);
    }
  }

  console.log('\n--- Verifying changes ---\n');

  const updatedProfiles = await request<ServerProfile[]>('/ip/hotspot/profile');
  for (const p of updatedProfiles) {
    const hasMacCookie = (p['login-by'] || '').includes('mac-cookie');
    const status = hasMacCookie ? '✓' : '✗';
    console.log(`  ${status} ${p.name}: login-by = ${p['login-by'] || 'default'}`);
  }

  console.log('\n=== EXPLANATION ===');
  console.log('');
  console.log('login-by methods (in order of priority):');
  console.log('  - mac-cookie: Auto-login by device MAC address (no user action needed)');
  console.log('  - cookie: Auto-login by browser HTTP cookie (requires same browser)');
  console.log('  - http-chap: Username/password login (user enters credentials)');
  console.log('');
  console.log('With mac-cookie enabled:');
  console.log('  1. User connects to WiFi');
  console.log('  2. Opens any webpage');
  console.log('  3. Hotspot checks MAC address against stored cookies');
  console.log('  4. If valid cookie exists → auto-logged in (no code entry)');
  console.log('  5. If no cookie → redirect to login page');
  console.log('');
}

main().catch(console.error);
