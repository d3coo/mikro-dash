import type { PageServerLoad, Actions } from './$types';
import { getAllSettings, setSetting, getMikroTikClient } from '$lib/server/services/settings';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
  const settings = await getAllSettings();
  return { settings };
};

export const actions: Actions = {
  save: async ({ request }) => {
    const formData = await request.formData();

    const fields = [
      'mikrotik_host',
      'mikrotik_user',
      'mikrotik_pass',
      'hotspot_server',
      'voucher_prefix',
      'business_name'
    ] as const;

    try {
      for (const field of fields) {
        const value = formData.get(field) as string;
        if (value !== null) {
          await setSetting(field, value);
        }
      }
      return { success: true };
    } catch (error) {
      console.error('Save settings error:', error);
      return fail(500, { error: 'فشل في حفظ الإعدادات' });
    }
  },

  testConnection: async () => {
    try {
      const client = await getMikroTikClient();
      const connected = await client.testConnection();

      if (connected) {
        const resources = await client.getSystemResources();
        return {
          testResult: {
            success: true,
            message: `متصل بنجاح! ${resources['board-name']} - ${resources.version}`
          }
        };
      } else {
        return {
          testResult: {
            success: false,
            message: 'فشل الاتصال بالراوتر'
          }
        };
      }
    } catch (error) {
      return {
        testResult: {
          success: false,
          message: `خطأ: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
  }
};
