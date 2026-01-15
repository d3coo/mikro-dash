import { MikroTikClient } from './src/lib/server/mikrotik/client';

const client = new MikroTikClient({
  host: '192.168.1.109',
  username: 'admin',
  password: 'need4speed'
});

async function query() {
  try {
    console.log('=== Testing Connection ===');
    const connected = await client.testConnection();
    console.log('Connected:', connected);

    if (!connected) {
      console.log('Cannot connect to MikroTik');
      return;
    }

    console.log('\n=== System Resources ===');
    const resources = await client.getSystemResources();
    console.log('Board:', resources['board-name']);
    console.log('Version:', resources.version);
    console.log('Uptime:', resources.uptime);

    console.log('\n=== Hotspot User Profiles ===');
    const profiles = await client.getHotspotUserProfiles();
    for (const p of profiles) {
      console.log(`\nProfile: ${p.name}`);
      console.log(`  ID: ${p['.id']}`);
      console.log(`  Rate Limit: ${p['rate-limit'] || 'none'}`);
      console.log(`  Session Timeout: ${p['session-timeout'] || 'none'}`);
      console.log(`  Shared Users: ${p['shared-users'] || '1'}`);
      console.log(`  MAC Cookie Timeout: ${p['mac-cookie-timeout'] || 'NOT SET'}`);
      console.log(`  Idle Timeout: ${p['idle-timeout'] || 'none'}`);
      console.log(`  Keepalive Timeout: ${p['keepalive-timeout'] || 'none'}`);
    }

    console.log('\n=== Hotspot Users (first 5 with details) ===');
    const users = await client.getHotspotUsers();
    console.log(`Total users: ${users.length}`);
    for (const u of users.slice(0, 5)) {
      console.log(`  ${u.name}:`);
      console.log(`    Profile: ${u.profile}`);
      console.log(`    Limit: ${u['limit-bytes-total'] || 'none'}`);
      console.log(`    Bytes In: ${u['bytes-in'] || '0'}`);
      console.log(`    Bytes Out: ${u['bytes-out'] || '0'}`);
      console.log(`    Uptime: ${u.uptime || 'none'}`);
      console.log('');
    }

    // Search for F001 user
    console.log('\n=== Looking for F001 user ===');
    const f001 = users.find(u => u.name.includes('F001') || u.name.includes('f001'));
    if (f001) {
      console.log('Found F001:');
      console.log(JSON.stringify(f001, null, 2));
    } else {
      console.log('F001 not found. Searching for users starting with F or G:');
      const fgUsers = users.filter(u => u.name.startsWith('F') || u.name.startsWith('G') || u.name.startsWith('f') || u.name.startsWith('g'));
      for (const u of fgUsers) {
        console.log(`  ${u.name}: profile=${u.profile}, server=${(u as any).server || 'default'}`);
        console.log(`    Full data: ${JSON.stringify(u)}`);
      }
    }

    console.log('\n=== Active Sessions ===');
    const sessions = await client.getActiveSessions();
    console.log(`Active sessions: ${sessions.length}`);
    for (const s of sessions) {
      console.log(`  User: ${s.user}`);
      console.log(`    IP: ${s.address}`);
      console.log(`    MAC: ${s['mac-address']}`);
      console.log(`    Uptime: ${s.uptime}`);
      console.log(`    Bytes In: ${s['bytes-in']}`);
      console.log(`    Bytes Out: ${s['bytes-out']}`);
      console.log(`    Time Left: ${s['session-time-left'] || 'unlimited'}`);
      console.log('');
    }

    console.log('\n=== Wireless Interfaces ===');
    const wireless = await client.getWirelessInterfaces();
    for (const w of wireless) {
      console.log(`  ${w.name}: SSID="${w.ssid}" Band=${w.band} Disabled=${w.disabled}`);
    }

    console.log('\n=== Security Profiles ===');
    const security = await client.getSecurityProfiles();
    for (const s of security) {
      console.log(`  ${s.name}: Mode=${s.mode}`);
    }

    // Query hotspot servers
    console.log('\n=== Hotspot Servers ===');
    const servers = await client.request<Array<Record<string, string>>>('/ip/hotspot');
    for (const srv of servers) {
      console.log(`  ${srv.name}:`);
      console.log(`    Interface: ${srv.interface}`);
      console.log(`    Profile: ${srv.profile}`);
      console.log(`    Address Pool: ${srv['address-pool']}`);
      console.log(`    Disabled: ${srv.disabled}`);
    }

    // Query walled garden
    console.log('\n=== Walled Garden ===');
    const walled = await client.request<Array<Record<string, string>>>('/ip/hotspot/walled-garden');
    for (const w of walled) {
      console.log(`  ${w['dst-host'] || w.action}: ${w.comment || ''}`);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

query();
