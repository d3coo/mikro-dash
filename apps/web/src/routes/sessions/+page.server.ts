import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getDetailedSessions, deleteUser, type SessionInfo } from '$lib/server/services/sessions';
import { getMikroTikClient } from '$lib/server/services/mikrotik';

export type { SessionInfo };

export const load: PageServerLoad = async ({ url }) => {
  const search = url.searchParams.get('search') || '';
  const filterProfile = url.searchParams.get('profile') || '';
  const filterServer = url.searchParams.get('server') || '';

  let sessions: SessionInfo[] = [];
  let routerConnected = false;
  let profiles: string[] = [];
  let servers: string[] = [];

  try {
    const result = await getDetailedSessions();
    sessions = result.sessions;
    profiles = result.profiles;
    servers = result.servers;
    routerConnected = true;

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase();
      sessions = sessions.filter(s =>
        s.username.toLowerCase().includes(searchLower) ||
        s.macAddress?.toLowerCase().includes(searchLower) ||
        s.deviceName?.toLowerCase().includes(searchLower)
      );
    }

    if (filterProfile) {
      sessions = sessions.filter(s => s.profile === filterProfile);
    }

    if (filterServer) {
      sessions = sessions.filter(s => s.server === filterServer);
    }
  } catch (error) {
    console.error('Failed to load sessions:', error);
  }

  return {
    sessions,
    routerConnected,
    search,
    filterProfile,
    filterServer,
    profiles,
    servers
  };
};

export const actions: Actions = {
  delete: async ({ request }) => {
    const formData = await request.formData();
    const userId = formData.get('userId') as string;

    if (!userId) {
      return fail(400, { error: 'معرف المستخدم مطلوب' });
    }

    try {
      await deleteUser(userId);
      return { success: true, deleted: true };
    } catch (error) {
      console.error('Delete user error:', error);
      return fail(500, { error: 'فشل في حذف المستخدم' });
    }
  }
};
