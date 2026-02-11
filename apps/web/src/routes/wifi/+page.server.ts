import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import {
  getAccessPoints,
  getNetworkGroups,
  getWirelessClients,
  getSecurityProfiles,
  toggleAccessPoint,
  updateAccessPointSSID,
  updateNetworkGroupSSID,
  updateWiFiPassword,
  createVirtualAP,
  deleteVirtualAP
} from '$lib/server/services/wifi';
import { getMikroTikClient } from '$lib/server/services/mikrotik';

export const load: PageServerLoad = async () => {
  let networkGroups: Awaited<ReturnType<typeof getNetworkGroups>> = [];
  let accessPoints: Awaited<ReturnType<typeof getAccessPoints>> = [];
  let clients: Awaited<ReturnType<typeof getWirelessClients>> = [];
  let securityProfiles: Awaited<ReturnType<typeof getSecurityProfiles>> = [];
  let routerConnected = false;

  try {
    const client = await getMikroTikClient();
    await client.getSystemResources();
    routerConnected = true;

    [networkGroups, accessPoints, clients, securityProfiles] = await Promise.all([
      getNetworkGroups(),
      getAccessPoints(),
      getWirelessClients(),
      getSecurityProfiles()
    ]);
  } catch (error) {
    console.error('Failed to connect to router:', error);
  }

  // Get physical interfaces for Virtual AP creation
  const physicalInterfaces = accessPoints.filter(ap => !ap.isVirtual);

  return {
    networkGroups,
    accessPoints,
    clients,
    securityProfiles,
    physicalInterfaces,
    routerConnected
  };
};

export const actions: Actions = {
  toggleAP: async ({ request }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;
    const disabled = formData.get('disabled') === 'true';

    if (!id) {
      return fail(400, { error: 'معرف الواجهة مطلوب' });
    }

    try {
      await toggleAccessPoint(id, disabled);
      return { success: true };
    } catch (error) {
      console.error('Toggle AP error:', error);
      return fail(500, { error: 'فشل في تغيير حالة نقطة الوصول' });
    }
  },

  updateSSID: async ({ request }) => {
    const formData = await request.formData();
    const ids = formData.get('ids') as string;
    const ssid = formData.get('ssid') as string;

    if (!ids || !ssid) {
      return fail(400, { error: 'معرف الواجهة واسم الشبكة مطلوبان' });
    }

    try {
      const idList = ids.split(',');
      await updateNetworkGroupSSID(idList, ssid);
      return { success: true, ssidUpdated: true };
    } catch (error) {
      console.error('Update SSID error:', error);
      return fail(500, { error: 'فشل في تحديث اسم الشبكة' });
    }
  },

  updatePassword: async ({ request }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;
    const password = formData.get('password') as string;

    if (!id || !password) {
      return fail(400, { error: 'معرف البروفايل وكلمة المرور مطلوبان' });
    }

    if (password.length < 8) {
      return fail(400, { error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
    }

    try {
      await updateWiFiPassword(id, password);
      return { success: true, passwordUpdated: true };
    } catch (error) {
      console.error('Update password error:', error);
      return fail(500, { error: 'فشل في تحديث كلمة المرور' });
    }
  },

  createVAP: async ({ request }) => {
    const formData = await request.formData();
    const masterInterface = formData.get('masterInterface') as string;
    const ssid = formData.get('ssid') as string;
    const securityProfile = formData.get('securityProfile') as string;
    const name = formData.get('name') as string || undefined;

    if (!masterInterface || !ssid || !securityProfile) {
      return fail(400, { error: 'جميع الحقول مطلوبة' });
    }

    try {
      await createVirtualAP(masterInterface, ssid, securityProfile, name);
      return { success: true, vapCreated: true };
    } catch (error) {
      console.error('Create VAP error:', error);
      return fail(500, { error: 'فشل في إنشاء نقطة الوصول الافتراضية' });
    }
  },

  deleteVAP: async ({ request }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;

    if (!id) {
      return fail(400, { error: 'معرف الواجهة مطلوب' });
    }

    try {
      await deleteVirtualAP(id);
      return { success: true, vapDeleted: true };
    } catch (error) {
      console.error('Delete VAP error:', error);
      return fail(500, { error: 'فشل في حذف نقطة الوصول' });
    }
  }
};
