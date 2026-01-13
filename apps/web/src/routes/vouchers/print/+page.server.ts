import type { PageServerLoad } from './$types';
import { getVoucherById } from '$lib/server/services/vouchers';
import { getSetting } from '$lib/server/services/settings';
import { getPackageById } from '$lib/voucher-packages';

export const load: PageServerLoad = async ({ url }) => {
  const idsParam = url.searchParams.get('ids') ?? '';
  const ids = idsParam.split(',').filter(Boolean);

  const vouchers = ids
    .map(id => getVoucherById(id))
    .filter((v): v is NonNullable<typeof v> => v !== undefined)
    .map(v => ({
      ...v,
      pkg: getPackageById(v.package)
    }));

  const businessName = await getSetting('business_name');

  return {
    vouchers,
    businessName
  };
};
