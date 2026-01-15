import type { PageServerLoad } from './$types';
import { getMikroTikClient } from '$lib/server/services/mikrotik';
import { getPackageByCodePrefix, getSettings, type PackageConfig } from '$lib/server/config';

interface PrintVoucher {
  id: string;
  name: string;
  password: string;
  profile: string;
  priceLE: number;
  pkg: PackageConfig | undefined;
}

export const load: PageServerLoad = async ({ url }) => {
  const idsParam = url.searchParams.get('ids') ?? '';
  const ids = idsParam.split(',').filter(Boolean);

  let vouchers: PrintVoucher[] = [];

  if (ids.length > 0) {
    try {
      const client = getMikroTikClient();
      const allUsers = await client.getHotspotUsers();

      // Find the vouchers by their MikroTik .id
      vouchers = ids
        .map(id => {
          const user = allUsers.find((u: any) => u['.id'] === id);
          if (!user) return null;

          // Match package by voucher name prefix (e.g., G3AB -> G3 -> 3GB package)
          const pkg = getPackageByCodePrefix(user.name);
          return {
            id: user['.id'],
            name: user.name,
            password: user.password || '',
            profile: user.profile,
            priceLE: pkg?.priceLE || 0,
            pkg
          };
        })
        .filter((v): v is PrintVoucher => v !== null);
    } catch (error) {
      console.error('Failed to fetch vouchers from MikroTik:', error);
    }
  }

  const settings = getSettings();

  return {
    vouchers,
    businessName: settings.business.name
  };
};
