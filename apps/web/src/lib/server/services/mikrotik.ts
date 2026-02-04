import { MikroTikClient } from '$lib/server/mikrotik';
import { getSettings } from '$lib/server/config';

export async function getMikroTikClient(): Promise<MikroTikClient> {
  const settings = await getSettings();
  return new MikroTikClient({
    host: settings.mikrotik.host,
    username: settings.mikrotik.user,
    password: settings.mikrotik.pass
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
