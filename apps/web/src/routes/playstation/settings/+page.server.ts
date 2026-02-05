import type { PageServerLoad, Actions } from './$types';
import {
  getPsStations,
  createPsStation,
  updatePsStation,
  deletePsStation,
} from '$lib/server/convex';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
  const stations = await getPsStations();
  return { stations };
};

export const actions: Actions = {
  create: async ({ request }) => {
    const formData = await request.formData();
    const stationId = (formData.get('id') as string)?.trim();
    const name = (formData.get('name') as string)?.trim();
    const nameAr = (formData.get('nameAr') as string)?.trim();
    const macAddress = (formData.get('macAddress') as string)?.trim();
    const hourlyRate = parseInt(formData.get('hourlyRate') as string, 10);
    const hourlyRateMultiStr = (formData.get('hourlyRateMulti') as string)?.trim();
    const hourlyRateMulti = hourlyRateMultiStr ? parseInt(hourlyRateMultiStr, 10) : undefined;
    const monitorIp = (formData.get('monitorIp') as string)?.trim() || undefined;
    const monitorPort = parseInt(formData.get('monitorPort') as string, 10) || 8080;
    const monitorType = (formData.get('monitorType') as string) || 'tcl';
    const timerEndAction = (formData.get('timerEndAction') as string) || 'notify';
    const hdmiInput = parseInt(formData.get('hdmiInput') as string, 10) || 2;

    if (!stationId || !name || !nameAr || !macAddress || isNaN(hourlyRate)) {
      return fail(400, { error: 'جميع الحقول مطلوبة' });
    }

    // Validate MAC address format
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(macAddress)) {
      return fail(400, { error: 'صيغة MAC Address غير صحيحة' });
    }

    // Validate IP address format if provided
    if (monitorIp) {
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(monitorIp)) {
        return fail(400, { error: 'صيغة عنوان IP غير صحيحة' });
      }
    }

    try {
      const stations = await getPsStations();
      await createPsStation({
        stationId,
        name,
        nameAr,
        macAddress,
        hourlyRate: hourlyRate * 100, // Store in piasters
        hourlyRateMulti: hourlyRateMulti ? hourlyRateMulti * 100 : undefined,
        monitorIp,
        monitorPort,
        monitorType,
        timerEndAction,
        hdmiInput,
        sortOrder: stations.length,
      });
      return { success: true };
    } catch (error) {
      return fail(500, { error: error instanceof Error ? error.message : 'حدث خطأ' });
    }
  },

  update: async ({ request }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;
    const name = (formData.get('name') as string)?.trim();
    const nameAr = (formData.get('nameAr') as string)?.trim();
    const macAddress = (formData.get('macAddress') as string)?.trim();
    const hourlyRate = parseInt(formData.get('hourlyRate') as string, 10);
    const hourlyRateMultiStr = (formData.get('hourlyRateMulti') as string)?.trim();
    const hourlyRateMulti = hourlyRateMultiStr ? parseInt(hourlyRateMultiStr, 10) : undefined;
    const status = formData.get('status') as string;
    const monitorIp = (formData.get('monitorIp') as string)?.trim() || undefined;
    const monitorPort = parseInt(formData.get('monitorPort') as string, 10) || 8080;
    const monitorType = (formData.get('monitorType') as string) || undefined;
    const timerEndAction = (formData.get('timerEndAction') as string) || undefined;
    const hdmiInput = parseInt(formData.get('hdmiInput') as string, 10) || undefined;

    if (!id) {
      return fail(400, { error: 'معرف الجهاز مطلوب' });
    }

    // Validate MAC address format if provided
    if (macAddress) {
      const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
      if (!macRegex.test(macAddress)) {
        return fail(400, { error: 'صيغة MAC Address غير صحيحة' });
      }
    }

    // Validate IP address format if provided
    if (monitorIp) {
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(monitorIp)) {
        return fail(400, { error: 'صيغة عنوان IP غير صحيحة' });
      }
    }

    try {
      const updates: Record<string, unknown> = {};
      if (name) updates.name = name;
      if (nameAr) updates.nameAr = nameAr;
      if (macAddress) updates.macAddress = macAddress;
      if (!isNaN(hourlyRate)) updates.hourlyRate = hourlyRate * 100;
      if (hourlyRateMulti) updates.hourlyRateMulti = hourlyRateMulti * 100;
      if (status) updates.status = status;
      if (monitorIp) updates.monitorIp = monitorIp;
      updates.monitorPort = monitorPort;
      if (monitorType) updates.monitorType = monitorType;
      if (timerEndAction) updates.timerEndAction = timerEndAction;
      if (hdmiInput) updates.hdmiInput = hdmiInput;

      await updatePsStation(id, updates);
      return { success: true };
    } catch (error) {
      return fail(500, { error: error instanceof Error ? error.message : 'حدث خطأ' });
    }
  },

  delete: async ({ request }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;

    if (!id) {
      return fail(400, { error: 'معرف الجهاز مطلوب' });
    }

    try {
      await deletePsStation(id);
      return { success: true };
    } catch (error) {
      return fail(500, { error: error instanceof Error ? error.message : 'حدث خطأ' });
    }
  }
};
