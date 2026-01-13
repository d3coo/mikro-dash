import type { PageServerLoad } from './$types';
import { getMikroTikClient, getSetting } from '$lib/server/services/settings';

export const load: PageServerLoad = async () => {
  let activeUsers = 0;
  let routerConnected = false;
  let vouchers: any[] = [];
  let activeSessions: any[] = [];

  try {
    const client = await getMikroTikClient();
    
    // Test connection and get data
    const resources = await client.getSystemResources();
    routerConnected = true;
    
    // Get all hotspot users (vouchers)
    const hotspotUsers = await client.getHotspotUsers();
    
    // Filter out default/system users
    vouchers = hotspotUsers
      .filter(u => !u.name.includes('default') && u.name !== 'admin')
      .map(u => {
        const bytesIn = parseInt(u['bytes-in'] || '0', 10);
        const bytesOut = parseInt(u['bytes-out'] || '0', 10);
        const bytesTotal = bytesIn + bytesOut;
        const bytesLimit = parseInt(u['limit-bytes-total'] || '0', 10);
        const uptime = u.uptime || '0s';
        
        // Determine status
        let status = 'available';
        if (bytesLimit > 0 && bytesTotal >= bytesLimit) {
          status = 'exhausted';
        } else if (uptime !== '0s') {
          status = 'used';
        }
        
        return {
          id: u['.id'],
          name: u.name,
          password: u.password || '',
          profile: u.profile,
          bytesIn,
          bytesOut,
          bytesTotal,
          bytesLimit,
          uptime,
          status,
          comment: u.comment || ''
        };
      });
    
    // Get active sessions
    activeSessions = await client.getActiveSessions();
    activeUsers = activeSessions.length;
    
  } catch (error) {
    console.error('Failed to connect to router:', error);
    routerConnected = false;
  }

  // Calculate stats
  const availableVouchers = vouchers.filter(v => v.status === 'available').length;
  const usedVouchers = vouchers.filter(v => v.status === 'used').length;
  const exhaustedVouchers = vouchers.filter(v => v.status === 'exhausted').length;
  
  // Calculate revenue from used vouchers (based on comment which has price info)
  let todayRevenue = 0;
  for (const v of vouchers) {
    if (v.status === 'used' || v.status === 'exhausted') {
      // Extract price from comment like "1.5GB - 5LE"
      const match = v.comment.match(/(\d+)LE/);
      if (match) {
        todayRevenue += parseInt(match[1], 10);
      }
    }
  }

  const businessName = await getSetting('business_name') || 'MikroTik Dashboard';

  return {
    stats: {
      activeUsers,
      availableVouchers,
      usedVouchers,
      exhaustedVouchers,
      totalVouchers: vouchers.length,
      todayRevenue,
      routerConnected
    },
    vouchers,
    activeSessions,
    businessName
  };
};
