/**
 * Fix timeout settings on user profiles based on MikroTik community recommendations
 * - idle-timeout: none (don't kick idle users)
 * - keepalive-timeout: 1d (don't check device status frequently)
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

interface UserProfile {
  '.id': string;
  name: string;
  'idle-timeout'?: string;
  'keepalive-timeout'?: string;
  'mac-cookie-timeout'?: string;
  'session-timeout'?: string;
}

async function main() {
  console.log('=== UPDATING USER PROFILE TIMEOUTS ===\n');

  // Get current profiles
  const profiles = await request<UserProfile[]>('/ip/hotspot/user/profile');

  console.log('BEFORE:\n');
  for (const p of profiles) {
    console.log(`  ${p.name}:`);
    console.log(`    idle-timeout: ${p['idle-timeout'] || 'none'}`);
    console.log(`    keepalive-timeout: ${p['keepalive-timeout'] || 'none'}`);
    console.log(`    mac-cookie-timeout: ${p['mac-cookie-timeout'] || 'none'}`);
    console.log(`    session-timeout: ${p['session-timeout'] || 'unlimited'}`);
  }

  console.log('\n--- Applying community-recommended settings ---\n');

  for (const profile of profiles) {
    try {
      await request(`/ip/hotspot/user/profile/${profile['.id']}`, 'PATCH', {
        'idle-timeout': 'none',        // Don't kick idle users
        'keepalive-timeout': '1d'      // Check device status once per day
      });
      console.log(`  ✓ Updated "${profile.name}"`);
    } catch (error) {
      console.error(`  ✗ Failed to update "${profile.name}":`, error);
    }
  }

  console.log('\nAFTER:\n');

  const updatedProfiles = await request<UserProfile[]>('/ip/hotspot/user/profile');
  for (const p of updatedProfiles) {
    console.log(`  ${p.name}:`);
    console.log(`    idle-timeout: ${p['idle-timeout'] || 'none'}`);
    console.log(`    keepalive-timeout: ${p['keepalive-timeout'] || 'none'}`);
    console.log(`    mac-cookie-timeout: ${p['mac-cookie-timeout'] || 'none'}`);
    console.log(`    session-timeout: ${p['session-timeout'] || 'unlimited'}`);
  }

  console.log('\n=== WHAT THIS MEANS ===\n');
  console.log('idle-timeout: none');
  console.log('  → Users won\'t be kicked for being inactive\n');
  console.log('keepalive-timeout: 1d');
  console.log('  → Router only checks if device is alive once per day');
  console.log('  → Users can leave and return without losing session\n');
  console.log('mac-cookie-timeout: 1d');
  console.log('  → Even if session ends, MAC cookie allows auto-relogin for 24h\n');
}

main().catch(console.error);
