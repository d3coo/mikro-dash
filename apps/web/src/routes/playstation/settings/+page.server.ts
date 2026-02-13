import type { PageServerLoad, Actions } from './$types';
import {
  getPsStations,
  getPsStationById,
  createPsStation,
  updatePsStation,
  deletePsStation,
  updatePsStationInternet,
} from '$lib/server/convex';
import { fail } from '@sveltejs/kit';
import { getMikroTikClient } from '$lib/server/services/mikrotik';
import { syncPsRouterRules, normalizeMac } from '$lib/server/services/playstation';

export const load: PageServerLoad = async () => {
  const stations = await getPsStations();

  // Sync all PS router rules in background (non-blocking)
  syncPsRouterRules().catch(() => {});

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

    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(macAddress)) {
      return fail(400, { error: 'صيغة MAC Address غير صحيحة' });
    }

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
        hourlyRate: hourlyRate * 100,
        hourlyRateMulti: hourlyRateMulti ? hourlyRateMulti * 100 : undefined,
        monitorIp,
        monitorPort,
        monitorType,
        timerEndAction,
        hdmiInput,
        sortOrder: stations.length,
      });

      // Add router rules for the new station
      try {
        const client = await getMikroTikClient();
        const mac = normalizeMac(macAddress);

        await client.allowPsStationMac(macAddress, name);
        await client.addIpBinding(mac, 'bypassed', `ps-bypass:${name}`);
        await client.addFirewallFilterRule({
          chain: 'forward',
          action: 'drop',
          srcMacAddress: mac,
          comment: `ps-internet:${name}`,
        });
      } catch (e) {
        console.error('[PS Settings] Failed to add router rules:', e);
      }

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

    if (macAddress) {
      const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
      if (!macRegex.test(macAddress)) {
        return fail(400, { error: 'صيغة MAC Address غير صحيحة' });
      }
    }

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

      // If MAC changed, update all router rules
      if (macAddress) {
        try {
          const client = await getMikroTikClient();
          const station = await getPsStationById(id);
          if (station && normalizeMac(station.macAddress) !== normalizeMac(macAddress)) {
            const oldName = station.name;
            const newName = name || station.name;
            const newMac = normalizeMac(macAddress);

            const [acl, fwRules, ipBindings] = await Promise.all([
              client.getWirelessAccessList(),
              client.getFirewallFilterRules(),
              client.getIpBindings(),
            ]);

            const oldAcl = acl.find((e) => e.comment === `ps-station:${oldName}`);
            if (oldAcl) await client.removeFromWirelessAccessList(oldAcl['.id']);

            const oldBypass = ipBindings.find((b) => b.comment === `ps-bypass:${oldName}`);
            if (oldBypass) await client.removeIpBinding(oldBypass['.id']);

            const oldFw = fwRules.find((r) => r.comment === `ps-internet:${oldName}`);
            if (oldFw) await client.removeFirewallFilterRule(oldFw['.id']);

            // Add new rules with new MAC
            await client.allowPsStationMac(macAddress, newName);
            await client.addIpBinding(newMac, 'bypassed', `ps-bypass:${newName}`);
            await client.addFirewallFilterRule({
              chain: 'forward',
              action: 'drop',
              srcMacAddress: newMac,
              comment: `ps-internet:${newName}`,
            });

            await updatePsStationInternet(id, false);
          }
        } catch (e) {
          console.error('[PS Settings] Failed to update router rules:', e);
        }
      }

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
      try {
        const station = await getPsStationById(id);
        if (station) {
          const client = await getMikroTikClient();

          const [acl, fwRules, ipBindings] = await Promise.all([
            client.getWirelessAccessList(),
            client.getFirewallFilterRules(),
            client.getIpBindings(),
          ]);

          const aclEntry = acl.find((e) => e.comment === `ps-station:${station.name}`);
          if (aclEntry) await client.removeFromWirelessAccessList(aclEntry['.id']);

          const bypassEntry = ipBindings.find((b) => b.comment === `ps-bypass:${station.name}`);
          if (bypassEntry) await client.removeIpBinding(bypassEntry['.id']);

          const fwRule = fwRules.find((r) => r.comment === `ps-internet:${station.name}`);
          if (fwRule) await client.removeFirewallFilterRule(fwRule['.id']);
        }
      } catch (e) {
        console.error('[PS Settings] Failed to remove router rules:', e);
      }

      await deletePsStation(id);
      return { success: true };
    } catch (error) {
      return fail(500, { error: error instanceof Error ? error.message : 'حدث خطأ' });
    }
  }
};
