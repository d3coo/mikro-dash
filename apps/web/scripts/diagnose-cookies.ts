/**
 * Diagnose why MAC cookie reconnection isn't working
 */

const ROUTER_HOST = '192.168.1.109';
const ROUTER_USER = 'admin';
const ROUTER_PASS = 'need4speed';

const baseUrl = `http://${ROUTER_HOST}/rest`;
const authHeader = 'Basic ' + Buffer.from(`${ROUTER_USER}:${ROUTER_PASS}`).toString('base64');

async function request<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`MikroTik API error: ${response.status} - ${error}`);
  }

  return response.json();
}

async function main() {
  console.log('=== DIAGNOSING COOKIE/RECONNECTION ISSUE ===\n');

  // 1. Check hotspot cookies
  console.log('1. HOTSPOT COOKIES (MAC bindings):');
  const cookies = await request<any[]>('/ip/hotspot/cookie');
  if (cookies.length === 0) {
    console.log('   ⚠ NO COOKIES FOUND - This is the problem!');
    console.log('   Cookies should be created when users log in.\n');
  } else {
    console.log(`   Found ${cookies.length} cookie(s):`);
    for (const c of cookies) {
      console.log(`   - User: ${c.user}, MAC: ${c['mac-address']}, Expires: ${c['expires-in'] || 'unknown'}`);
    }
    console.log();
  }

  // 2. Check hotspot server profiles (different from user profiles)
  console.log('2. HOTSPOT SERVER PROFILES:');
  const serverProfiles = await request<any[]>('/ip/hotspot/profile');
  for (const p of serverProfiles) {
    console.log(`   - ${p.name}:`);
    console.log(`     login-by: ${p['login-by'] || 'default'}`);
    console.log(`     cookie-lifetime: ${p['cookie-lifetime'] || 'not set'}`);
    console.log(`     http-cookie-lifetime: ${p['http-cookie-lifetime'] || 'not set'}`);
    console.log(`     use-radius: ${p['use-radius'] || 'no'}`);
  }
  console.log();

  // 3. Check hotspot user profiles
  console.log('3. HOTSPOT USER PROFILES:');
  const userProfiles = await request<any[]>('/ip/hotspot/user/profile');
  for (const p of userProfiles) {
    console.log(`   - ${p.name}:`);
    console.log(`     mac-cookie-timeout: ${p['mac-cookie-timeout'] || 'not set'}`);
    console.log(`     session-timeout: ${p['session-timeout'] || 'unlimited'}`);
    console.log(`     idle-timeout: ${p['idle-timeout'] || 'unlimited'}`);
    console.log(`     keepalive-timeout: ${p['keepalive-timeout'] || 'not set'}`);
    console.log(`     shared-users: ${p['shared-users'] || '1'}`);
  }
  console.log();

  // 4. Check hotspot servers
  console.log('4. HOTSPOT SERVERS:');
  const servers = await request<any[]>('/ip/hotspot');
  for (const s of servers) {
    console.log(`   - ${s.name}:`);
    console.log(`     interface: ${s.interface}`);
    console.log(`     profile: ${s.profile}`);
    console.log(`     disabled: ${s.disabled}`);
    console.log(`     addresses-per-mac: ${s['addresses-per-mac'] || 'unlimited'}`);
  }
  console.log();

  // 5. Check active sessions
  console.log('5. ACTIVE SESSIONS:');
  const sessions = await request<any[]>('/ip/hotspot/active');
  if (sessions.length === 0) {
    console.log('   No active sessions\n');
  } else {
    console.log(`   Found ${sessions.length} active session(s):`);
    for (const s of sessions) {
      console.log(`   - User: ${s.user}, MAC: ${s['mac-address']}, IP: ${s.address}, Uptime: ${s.uptime}`);
    }
    console.log();
  }

  // 6. Check IP bindings (static MAC-IP associations)
  console.log('6. IP BINDINGS (MAC-IP associations):');
  try {
    const bindings = await request<any[]>('/ip/hotspot/ip-binding');
    if (bindings.length === 0) {
      console.log('   No IP bindings configured\n');
    } else {
      console.log(`   Found ${bindings.length} binding(s):`);
      for (const b of bindings) {
        console.log(`   - MAC: ${b['mac-address'] || 'any'}, Address: ${b.address || 'any'}, Type: ${b.type}, Server: ${b.server || 'all'}`);
      }
      console.log();
    }
  } catch (e) {
    console.log('   Could not fetch IP bindings\n');
  }

  // 7. Check hosts (known devices)
  console.log('7. HOTSPOT HOSTS (known devices):');
  try {
    const hosts = await request<any[]>('/ip/hotspot/host');
    if (hosts.length === 0) {
      console.log('   No hosts\n');
    } else {
      console.log(`   Found ${hosts.length} host(s):`);
      for (const h of hosts.slice(0, 10)) {
        console.log(`   - MAC: ${h['mac-address']}, IP: ${h.address}, Authorized: ${h.authorized || 'no'}, Bypassed: ${h.bypassed || 'no'}`);
      }
      if (hosts.length > 10) console.log(`   ... and ${hosts.length - 10} more`);
      console.log();
    }
  } catch (e) {
    console.log('   Could not fetch hosts\n');
  }

  console.log('=== ANALYSIS ===\n');

  if (cookies.length === 0) {
    console.log('ISSUE: No cookies are being created.');
    console.log('POSSIBLE CAUSES:');
    console.log('  1. login-by method on server profile may not support cookies');
    console.log('  2. http-cookie-lifetime on server profile may be 0 or disabled');
    console.log('  3. Users are being deleted when they disconnect (instead of just session ending)');
    console.log();
  }

  // Check server profile for cookie support
  for (const p of serverProfiles) {
    const loginBy = p['login-by'] || '';
    if (!loginBy.includes('cookie')) {
      console.log(`WARNING: Server profile "${p.name}" login-by="${loginBy}" may not include cookie support.`);
      console.log('  Consider adding "cookie" to login-by methods.\n');
    }
  }
}

main().catch(console.error);
