import type { PageServerLoad } from './$types';
import { getDashboardData } from '$lib/server/services/dashboard';

export const load: PageServerLoad = async () => {
  return getDashboardData();
};
