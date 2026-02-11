import { MikroTikClient } from '$lib/server/mikrotik';
import { getSettings as getConvexSettings } from '$lib/server/convex';

export async function getMikroTikClient(): Promise<MikroTikClient> {
  const settings = await getConvexSettings();
  return new MikroTikClient({
    host: settings['mikrotik_host'] || '192.168.1.109',
    username: settings['mikrotik_user'] || 'admin',
    password: settings['mikrotik_pass'] || ''
  });
}

export async function testRouterConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const client = await getMikroTikClient();
    const connected = await client.testConnection();

    if (connected) {
      const resources = await client.getSystemResources();
      return {
        success: true,
        message: `متصل بنجاح! ${resources['board-name']} - ${resources.version}`
      };
    } else {
      return {
        success: false,
        message: 'فشل الاتصال بالراوتر'
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `خطأ: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
