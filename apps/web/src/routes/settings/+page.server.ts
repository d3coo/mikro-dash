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
  const settings = getSettings();
  const packages = getPackages();

  let profiles: { id: string; name: string; rateLimit?: string; sessionTimeout?: string; sharedUsers?: string; macCookieTimeout?: string }[] = [];
  let hotspotServers: { id: string; name: string }[] = [];

  try {
    const client = getMikroTikClient();
    const mikrotikProfiles = await client.getHotspotUserProfiles();
    profiles = mikrotikProfiles.map(p => ({
      id: p['.id'],
      name: p.name,
      rateLimit: p['rate-limit'],
      sessionTimeout: p['session-timeout'],
      sharedUsers: p['shared-users'],
      macCookieTimeout: p['mac-cookie-timeout']
    }));

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

    try {
      updateSettings({
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

  // Package actions (metadata only - bytes come from MikroTik profile)
  createPackage: async ({ request }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;
    const name = formData.get('name') as string;
    const nameAr = formData.get('nameAr') as string;
    const priceLE = parseInt(formData.get('priceLE') as string, 10);
    const profile = formData.get('profile') as string;
    const server = formData.get('server') as string || null;
    const sortOrder = parseInt(formData.get('sortOrder') as string, 10) || 0;

    if (!id || !name || !nameAr || priceLE < 0 || isNaN(priceLE) || !profile) {
      return fail(400, { error: 'جميع الحقول مطلوبة' });
    }

    try {
      createPackage({ id, name, nameAr, priceLE, profile, server, codePrefix: '', sortOrder });
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
    const profile = formData.get('profile') as string;
    const server = formData.get('server') as string || null;
    const sortOrder = parseInt(formData.get('sortOrder') as string, 10) || 0;

    if (!id) {
      return fail(400, { error: 'معرف الباقة مطلوب' });
    }

    try {
      updatePackage(id, { name, nameAr, priceLE, profile, server, sortOrder });
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
      deletePackage(id);
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
      const client = getMikroTikClient();
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
      const client = getMikroTikClient();
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
      const client = getMikroTikClient();
      await client.deleteHotspotUserProfile(id);
      return { profileSuccess: true, deleted: true };
    } catch (error) {
      console.error('Delete profile error:', error);
      return fail(500, { error: 'فشل في حذف البروفايل' });
    }
  }
};
