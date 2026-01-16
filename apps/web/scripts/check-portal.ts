/**
 * Check hotspot portal configuration and status page setup
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
  console.log('=== HOTSPOT PORTAL CONFIGURATION ===\n');

  // 1. Check hotspot server profiles
  console.log('1. HOTSPOT SERVER PROFILES:');
  const serverProfiles = await request<any[]>('/ip/hotspot/profile');
  for (const p of serverProfiles) {
    console.log(`\n   ${p.name}:`);
    console.log(`     html-directory: ${p['html-directory'] || 'hotspot'}`);
    console.log(`     login-by: ${p['login-by'] || 'default'}`);
    console.log(`     http-proxy: ${p['http-proxy'] || 'not set'}`);
    console.log(`     smtp-server: ${p['smtp-server'] || 'not set'}`);
    console.log(`     dns-name: ${p['dns-name'] || 'not set'}`);
    console.log(`     hotspot-address: ${p['hotspot-address'] || 'not set'}`);
    console.log(`     status-autorefresh: ${p['status-autorefresh'] || '1m'}`);
  }

  // 2. Check hotspot servers
  console.log('\n\n2. HOTSPOT SERVERS:');
  const servers = await request<any[]>('/ip/hotspot');
  for (const s of servers) {
    console.log(`\n   ${s.name}:`);
    console.log(`     interface: ${s.interface}`);
    console.log(`     profile: ${s.profile}`);
    console.log(`     address-pool: ${s['address-pool'] || 'not set'}`);
    console.log(`     addresses-per-mac: ${s['addresses-per-mac'] || 'unlimited'}`);
  }

  // 3. Check hotspot files
  console.log('\n\n3. HOTSPOT HTML FILES:');
  try {
    const files = await request<any[]>('/file');
    const hotspotFiles = files.filter(f =>
      f.name.includes('hotspot') ||
      f.name.includes('flash/hotspot')
    );

    if (hotspotFiles.length === 0) {
      console.log('   No hotspot files found in root. Checking flash...');
    }

    for (const f of hotspotFiles.slice(0, 20)) {
      console.log(`   - ${f.name} (${f.size || 0} bytes)`);
    }
  } catch (e) {
    console.log('   Could not list files');
  }

  // 4. Check walled garden (allowed sites before login)
  console.log('\n\n4. WALLED GARDEN (allowed before login):');
  try {
    const garden = await request<any[]>('/ip/hotspot/walled-garden');
    if (garden.length === 0) {
      console.log('   No walled garden entries');
    } else {
      for (const g of garden) {
        console.log(`   - ${g['dst-host'] || g.action || 'unknown'}`);
      }
    }
  } catch (e) {
    console.log('   Could not fetch walled garden');
  }

  console.log('\n\n=== STATUS PAGE INFO ===\n');
  console.log('MikroTik hotspot provides these pages by default:');
  console.log('  - login.html      : Login page (enter voucher code)');
  console.log('  - status.html     : Status page (shows usage, logout button)');
  console.log('  - logout.html     : Logout confirmation');
  console.log('  - error.html      : Error messages');
  console.log('  - redirect.html   : Redirect after login');
  console.log('  - alogin.html     : Auto-login page (used by mac-cookie)');
  console.log('');
  console.log('Customers can access status page at:');
  console.log('  - http://<hotspot-ip>/status');
  console.log('  - Or click "Status" link on login page after authentication');
  console.log('');
  console.log('The status page shows:');
  console.log('  - Username');
  console.log('  - Session time / uptime');
  console.log('  - Bytes used (upload/download)');
  console.log('  - Time remaining (if session-timeout set)');
  console.log('  - Bytes remaining (if limit-bytes-total set)');
  console.log('  - Logout button');
}

main().catch(console.error);
