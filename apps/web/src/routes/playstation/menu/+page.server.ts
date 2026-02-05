import type { PageServerLoad, Actions } from './$types';
import {
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem
} from '$lib/server/services/playstation';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
  const menuItems = await getMenuItems();

  // Group by category
  const categories = {
    drinks: menuItems.filter(i => i.category === 'drinks'),
    food: menuItems.filter(i => i.category === 'food'),
    snacks: menuItems.filter(i => i.category === 'snacks')
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
      await createMenuItem({
        name,
        nameAr,
        category,
        price: price * 100
      });
      return { success: true };
    } catch (error) {
      return fail(500, { error: error instanceof Error ? error.message : 'حدث خطأ' });
    }
  },

  update: async ({ request }) => {
    const formData = await request.formData();
    const id = parseInt(formData.get('id') as string, 10);
    const name = (formData.get('name') as string)?.trim();
    const nameAr = (formData.get('nameAr') as string)?.trim();
    const category = formData.get('category') as string;
    const price = parseInt(formData.get('price') as string, 10);
    const isAvailable = formData.get('isAvailable') === 'true' ? 1 : 0;

    if (isNaN(id)) {
      return fail(400, { error: 'معرف العنصر مطلوب' });
    }

    try {
      const updates: Parameters<typeof updateMenuItem>[1] = {};
      if (name) updates.name = name;
      if (nameAr) updates.nameAr = nameAr;
      if (category) updates.category = category;
      if (!isNaN(price)) updates.price = price * 100; // Convert to piasters
      updates.isAvailable = isAvailable;

      await updateMenuItem(id, updates);
      return { success: true };
    } catch (error) {
      return fail(500, { error: error instanceof Error ? error.message : 'حدث خطأ' });
    }
  },

  delete: async ({ request }) => {
    const formData = await request.formData();
    const id = parseInt(formData.get('id') as string, 10);

    if (isNaN(id)) {
      return fail(400, { error: 'معرف العنصر مطلوب' });
    }

    try {
      await deleteMenuItem(id);
      return { success: true };
    } catch (error) {
      return fail(500, { error: error instanceof Error ? error.message : 'حدث خطأ' });
    }
  }
};
