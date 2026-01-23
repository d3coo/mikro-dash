import type { PageServerLoad, Actions } from './$types';
import {
  getStations,
  getStationById,
  createStation,
  updateStation,
  deleteStation
} from '$lib/server/services/playstation';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
  const stations = getStations();
  return { stations };
};

export const actions: Actions = {
  create: async ({ request }) => {
    const formData = await request.formData();
    const id = (formData.get('id') as string)?.trim();
    const name = (formData.get('name') as string)?.trim();
    const nameAr = (formData.get('nameAr') as string)?.trim();
    const macAddress = (formData.get('macAddress') as string)?.trim();
    const hourlyRate = parseInt(formData.get('hourlyRate') as string, 10);
    const monitorIp = (formData.get('monitorIp') as string)?.trim() || null;
    const monitorPort = parseInt(formData.get('monitorPort') as string, 10) || 8080;
    const monitorType = (formData.get('monitorType') as string) || 'tcl';
    const timerEndAction = (formData.get('timerEndAction') as string) || 'notify';
    const hdmiInput = parseInt(formData.get('hdmiInput') as string, 10) || 2;

    if (!id || !name || !nameAr || !macAddress || isNaN(hourlyRate)) {
      return fail(400, { error: 'جميع الحقول مطلوبة' });
    }

    // Check for duplicate ID
    const existing = getStationById(id);
    if (existing) {
      return fail(400, { error: 'معرف الجهاز موجود بالفعل' });
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
      // Convert rate from EGP to piasters (multiply by 100)
      const stations = getStations();
      createStation({
        id,
        name,
        nameAr,
        macAddress,
        hourlyRate: hourlyRate * 100, // Store in piasters
        monitorIp,
        monitorPort,
        monitorType,
        timerEndAction,
        hdmiInput,
        sortOrder: stations.length
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
    const status = formData.get('status') as string;
    const monitorIp = (formData.get('monitorIp') as string)?.trim() || null;
    const monitorPort = parseInt(formData.get('monitorPort') as string, 10) || 8080;
    const monitorType = (formData.get('monitorType') as string) || null;
    const timerEndAction = (formData.get('timerEndAction') as string) || null;
    const hdmiInput = parseInt(formData.get('hdmiInput') as string, 10) || null;

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
      const updates: Parameters<typeof updateStation>[1] = {};
      if (name) updates.name = name;
      if (nameAr) updates.nameAr = nameAr;
      if (macAddress) updates.macAddress = macAddress;
      if (!isNaN(hourlyRate)) updates.hourlyRate = hourlyRate * 100; // Store in piasters
      if (status) updates.status = status;
      updates.monitorIp = monitorIp;
      updates.monitorPort = monitorPort;
      if (monitorType) updates.monitorType = monitorType;
      if (timerEndAction) updates.timerEndAction = timerEndAction;
      if (hdmiInput) updates.hdmiInput = hdmiInput;

      updateStation(id, updates);
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
      deleteStation(id);
      return { success: true };
    } catch (error) {
      return fail(500, { error: error instanceof Error ? error.message : 'حدث خطأ' });
    }
  }
};
