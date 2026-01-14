import type { PageServerLoad, Actions } from './$types';
import { getAllSettings, setSetting, getMikroTikClient } from '$lib/server/services/settings';
import { getAllPackages, createPackage, updatePackage, deletePackage } from '$lib/server/services/packages';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
  const settings = await getAllSettings();
  const packages = await getAllPackages();

  let profiles: { id: string; name: string; rateLimit?: string; sessionTimeout?: string; sharedUsers?: string; macCookieTimeout?: string }[] = [];
  let hotspotServers: { id: string; name: string }[] = [];
  try {
    const client = await getMikroTikClient();
    const mikrotikProfiles = await client.getHotspotUserProfiles();
    profiles = mikrotikProfiles.map(p => ({
      id: p['.id'],
      name: p.name,
      rateLimit: p['rate-limit'],
      sessionTimeout: p['session-timeout'],
      sharedUsers: p['shared-users'],
      macCookieTimeout: p['mac-cookie-timeout']
    }));

    // Get hotspot servers for restricting packages to specific WiFi networks
    const servers = await client.getHotspotServers();
    hotspotServers = servers.map(s => ({
      id: s['.id'],
      name: s.name
    }));
  } catch {
    // Router not connected
  }

  return { settings, packages, profiles, hotspotServers };
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
  },

  // Package actions
  createPackage: async ({ request }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;
    const name = formData.get('name') as string;
    const nameAr = formData.get('nameAr') as string;
    const bytes = parseInt(formData.get('bytes') as string, 10);
    const priceLE = parseInt(formData.get('priceLE') as string, 10);
    const profile = formData.get('profile') as string;
    const server = formData.get('server') as string || null; // Hotspot server to restrict access
    const codePrefix = formData.get('codePrefix') as string;
    const sortOrder = parseInt(formData.get('sortOrder') as string, 10) || 0;

    if (!id || !name || !nameAr || !bytes || priceLE < 0 || isNaN(priceLE) || !profile || !codePrefix) {
      return fail(400, { error: 'جميع الحقول مطلوبة' });
    }

    try {
      await createPackage({ id, name, nameAr, bytes, priceLE, profile, server, codePrefix, sortOrder });
      return { packageSuccess: true };
    } catch (error) {
      console.error('Create package error:', error);
      return fail(500, { error: 'فشل في إنشاء الباقة' });
    }
  },

  updatePackage: async ({ request }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;
    const name = formData.get('name') as string;
    const nameAr = formData.get('nameAr') as string;
    const bytes = parseInt(formData.get('bytes') as string, 10);
    const priceLE = parseInt(formData.get('priceLE') as string, 10);
    const profile = formData.get('profile') as string;
    const server = formData.get('server') as string || null; // Hotspot server to restrict access
    const codePrefix = formData.get('codePrefix') as string;
    const sortOrder = parseInt(formData.get('sortOrder') as string, 10) || 0;

    if (!id) {
      return fail(400, { error: 'معرف الباقة مطلوب' });
    }

    try {
      await updatePackage(id, { name, nameAr, bytes, priceLE, profile, server, codePrefix, sortOrder });
      return { packageSuccess: true };
    } catch (error) {
      console.error('Update package error:', error);
      return fail(500, { error: 'فشل في تحديث الباقة' });
    }
  },

  deletePackage: async ({ request }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;

    if (!id) {
      return fail(400, { error: 'معرف الباقة مطلوب' });
    }

    try {
      await deletePackage(id);
      return { packageSuccess: true, deleted: true };
    } catch (error) {
      console.error('Delete package error:', error);
      return fail(500, { error: 'فشل في حذف الباقة' });
    }
  },

  // Profile actions
  createProfile: async ({ request }) => {
    const formData = await request.formData();
    const name = formData.get('name') as string;
    const rateLimit = formData.get('rateLimit') as string;
    const sessionTimeout = formData.get('sessionTimeout') as string;
    const sharedUsers = formData.get('sharedUsers') as string;

    if (!name) {
      return fail(400, { error: 'اسم البروفايل مطلوب' });
    }

    try {
      const client = await getMikroTikClient();
      await client.createHotspotUserProfile(name, { rateLimit, sessionTimeout, sharedUsers });
      return { profileSuccess: true };
    } catch (error) {
      console.error('Create profile error:', error);
      return fail(500, { error: 'فشل في إنشاء البروفايل' });
    }
  },

  updateProfile: async ({ request }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;
    const name = formData.get('name') as string;
    const rateLimit = formData.get('rateLimit') as string;
    const sessionTimeout = formData.get('sessionTimeout') as string;
    const sharedUsers = formData.get('sharedUsers') as string;
    const macCookieTimeout = formData.get('macCookieTimeout') as string;

    if (!id) {
      return fail(400, { error: 'معرف البروفايل مطلوب' });
    }

    try {
      const client = await getMikroTikClient();
      await client.updateHotspotUserProfile(id, { name, rateLimit, sessionTimeout, sharedUsers, macCookieTimeout });
      return { profileSuccess: true };
    } catch (error) {
      console.error('Update profile error:', error);
      return fail(500, { error: 'فشل في تحديث البروفايل' });
    }
  },

  deleteProfile: async ({ request }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;

    if (!id) {
      return fail(400, { error: 'معرف البروفايل مطلوب' });
    }

    try {
      const client = await getMikroTikClient();
      await client.deleteHotspotUserProfile(id);
      return { profileSuccess: true, deleted: true };
    } catch (error) {
      console.error('Delete profile error:', error);
      return fail(500, { error: 'فشل في حذف البروفايل' });
    }
  }
};
