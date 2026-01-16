/**
 * Fix user reconnection issue by setting mac-cookie-timeout on all hotspot profiles.
 * This allows users to automatically re-authenticate when returning to the network
 * with the same device (MAC address) within 24 hours.
 *
 * Run with: bun run scripts/fix-reconnection.ts
 */

const ROUTER_HOST = '192.168.1.109';
const ROUTER_USER = 'admin';
const ROUTER_PASS = 'need4speed';
const MAC_COOKIE_TIMEOUT = '1d'; // 24 hours

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

interface Profile {
  '.id': string;
  name: string;
  'mac-cookie-timeout'?: string;
}

async function main() {
  console.log('Fetching hotspot user profiles...\n');

  const profiles = await request<Profile[]>('/ip/hotspot/user/profile');

  console.log(`Found ${profiles.length} profile(s):\n`);

  for (const profile of profiles) {
    const currentTimeout = profile['mac-cookie-timeout'] || 'none';
    console.log(`  - ${profile.name}: mac-cookie-timeout = ${currentTimeout}`);
  }

  console.log(`\nUpdating all profiles to mac-cookie-timeout = ${MAC_COOKIE_TIMEOUT}...\n`);

  for (const profile of profiles) {
    try {
      await request(`/ip/hotspot/user/profile/${profile['.id']}`, 'PATCH', {
        'mac-cookie-timeout': MAC_COOKIE_TIMEOUT
      });
      console.log(`  ✓ Updated "${profile.name}"`);
    } catch (error) {
      console.error(`  ✗ Failed to update "${profile.name}":`, error);
    }
  }

  console.log('\nVerifying changes...\n');

  const updatedProfiles = await request<Profile[]>('/ip/hotspot/user/profile');

  for (const profile of updatedProfiles) {
    const timeout = profile['mac-cookie-timeout'] || 'none';
    const status = timeout === MAC_COOKIE_TIMEOUT ? '✓' : '✗';
    console.log(`  ${status} ${profile.name}: mac-cookie-timeout = ${timeout}`);
  }

  console.log('\nDone! Users can now reconnect within 24 hours without re-entering their voucher code.');
}

main().catch(console.error);
