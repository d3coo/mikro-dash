import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import {
  getSettings,
  updateSettings,
  getPackages,
  createPackage,
  updatePackage,
  deletePackage,
  type PackageConfig
} from '$lib/server/config';
import { getMikroTikClient, testRouterConnection } from '$lib/server/services/mikrotik';

export const load: PageServerLoad = async () => {
  // Fetch SQLite data and router data in parallel
  const [settings, packages, routerData] = await Promise.all([
    getSettings().catch(() => ({
      mikrotik: { host: '192.168.1.109', user: 'admin', pass: 'need4speed' },
      business: { name: 'AboYassen WiFi' },
      wifi: { ssid: 'AboYassen' }
    })),
    getPackages().catch(() => []),
    (async () => {
      const client = await getMikroTikClient();
      const [mikrotikProfiles, servers] = await Promise.all([
        client.getHotspotUserProfiles(),
        client.getHotspotServers()
      ]);
      return {
        profiles: mikrotikProfiles.map(p => ({
          id: p['.id'],
          name: p.name,
          rateLimit: p['rate-limit'],
          sessionTimeout: p['session-timeout'],
          sharedUsers: p['shared-users'],
          macCookieTimeout: p['mac-cookie-timeout']
        })),
        hotspotServers: servers.map(s => ({ id: s['.id'], name: s.name }))
      };
    })().catch(() => ({ profiles: [] as any[], hotspotServers: [] as any[] }))
  ]);

  return { settings, packages, profiles: routerData.profiles, hotspotServers: routerData.hotspotServers };
};

export const actions: Actions = {
  save: async ({ request }) => {
    const formData = await request.formData();

    try {
      await updateSettings({
        mikrotik: {
          host: formData.get('mikrotik_host') as string,
          user: formData.get('mikrotik_user') as string,
          pass: formData.get('mikrotik_pass') as string
        },
        business: {
          name: formData.get('business_name') as string
        }
      });
      return { success: true };
    } catch (error) {
      console.error('Save settings error:', error);
      return fail(500, { error: 'فشل في حفظ الإعدادات' });
    }
  },

  testConnection: async () => {
    const result = await testRouterConnection();
    return { testResult: result };
  },

  // Package actions
  createPackage: async ({ request }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;
    const name = formData.get('name') as string;
    const nameAr = formData.get('nameAr') as string;
    const priceLE = parseInt(formData.get('priceLE') as string, 10);
    const bytesLimitGB = parseFloat(formData.get('bytesLimitGB') as string) || 0;
    const bytesLimit = Math.round(bytesLimitGB * 1024 * 1024 * 1024); // Convert GB to bytes
    const profile = formData.get('profile') as string;
    const server = formData.get('server') as string || null;
    const sortOrder = parseInt(formData.get('sortOrder') as string, 10) || 0;

    if (!id || !name || !nameAr || priceLE < 0 || isNaN(priceLE) || !profile) {
      return fail(400, { error: 'جميع الحقول مطلوبة' });
    }

    try {
      await createPackage({ id, name, nameAr, priceLE, bytesLimit, profile, server, codePrefix: '', sortOrder });
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
    const priceLE = parseInt(formData.get('priceLE') as string, 10);
    const bytesLimitGB = parseFloat(formData.get('bytesLimitGB') as string) || 0;
    const bytesLimit = Math.round(bytesLimitGB * 1024 * 1024 * 1024); // Convert GB to bytes
    const profile = formData.get('profile') as string;
    const server = formData.get('server') as string || null;
    const sortOrder = parseInt(formData.get('sortOrder') as string, 10) || 0;

    if (!id) {
      return fail(400, { error: 'معرف الباقة مطلوب' });
    }

    try {
      await updatePackage(id, { name, nameAr, priceLE, bytesLimit, profile, server, sortOrder });
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

  // Profile actions (MikroTik)
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
