import type { PageServerLoad, Actions } from './$types';
import { getMikroTikClient } from '$lib/server/services/settings';
import { fail } from '@sveltejs/kit';

const PAGE_SIZE = 10;

export const load: PageServerLoad = async ({ url }) => {
  const page = parseInt(url.searchParams.get('page') || '1', 10);

  let activeSessions: any[] = [];
  let routerConnected = false;

  try {
    const client = await getMikroTikClient();
    await client.getSystemResources(); // Test connection
    routerConnected = true;

    activeSessions = await client.getActiveSessions();
  } catch (error) {
    console.error('Failed to connect to router:', error);
    routerConnected = false;
  }

  // Calculate pagination
  const totalItems = activeSessions.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const currentPage = Math.min(Math.max(1, page), totalPages || 1);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;

  const paginatedSessions = activeSessions.slice(startIndex, endIndex);

  return {
    sessions: paginatedSessions,
    totalSessions: totalItems,
    routerConnected,
    pagination: {
      currentPage,
      totalPages,
      pageSize: PAGE_SIZE,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1
    }
  };
};

export const actions: Actions = {
  kick: async ({ request }) => {
    const formData = await request.formData();
    const sessionId = formData.get('sessionId') as string;

    if (!sessionId) {
      return fail(400, { error: 'معرف الجلسة مطلوب' });
    }

    try {
      const client = await getMikroTikClient();
      await client.kickSession(sessionId);
      return { success: true, kicked: true };
    } catch (error) {
      console.error('Kick session error:', error);
      return fail(500, { error: 'فشل في قطع الاتصال' });
    }
  }
};
