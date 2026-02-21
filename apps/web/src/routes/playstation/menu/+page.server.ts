import type { PageServerLoad, Actions } from './$types';
import {
  getPsMenuItems,
  createPsMenuItem,
  updatePsMenuItem,
  deletePsMenuItem,
} from '$lib/server/convex';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
  let menuItems: Awaited<ReturnType<typeof getPsMenuItems>> = [];

  try {
    menuItems = await getPsMenuItems();
  } catch (error) {
    console.error('Failed to get PS menu items:', error);
  }

  // Group by category
  const categories = {
    drinks: menuItems.filter((i) => i.category === 'drinks'),
    food: menuItems.filter((i) => i.category === 'food'),
    snacks: menuItems.filter((i) => i.category === 'snacks'),
  };

  return { menuItems, categories };
};

export const actions: Actions = {
  create: async ({ request }) => {
    const formData = await request.formData();
    const name = (formData.get('name') as string)?.trim();
    const nameAr = (formData.get('nameAr') as string)?.trim();
    const category = formData.get('category') as string;
    const price = parseInt(formData.get('price') as string, 10);

    if (!name || !nameAr || !category || isNaN(price)) {
      return fail(400, { error: 'جميع الحقول مطلوبة' });
    }

    try {
      // Price is in EGP, convert to piasters (multiply by 100)
      await createPsMenuItem({
        name,
        nameAr,
        category,
        price: price * 100,
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
    const category = formData.get('category') as string;
    const price = parseInt(formData.get('price') as string, 10);
    const isAvailable = formData.get('isAvailable') === 'true';

    if (!id) {
      return fail(400, { error: 'معرف العنصر مطلوب' });
    }

    try {
      const updates: Record<string, unknown> = {};
      if (name) updates.name = name;
      if (nameAr) updates.nameAr = nameAr;
      if (category) updates.category = category;
      if (!isNaN(price)) updates.price = price * 100;
      updates.isAvailable = isAvailable;

      await updatePsMenuItem(id, updates);
      return { success: true };
    } catch (error) {
      return fail(500, { error: error instanceof Error ? error.message : 'حدث خطأ' });
    }
  },

  delete: async ({ request }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;

    if (!id) {
      return fail(400, { error: 'معرف العنصر مطلوب' });
    }

    try {
      await deletePsMenuItem(id);
      return { success: true };
    } catch (error) {
      return fail(500, { error: error instanceof Error ? error.message : 'حدث خطأ' });
    }
  }
};
