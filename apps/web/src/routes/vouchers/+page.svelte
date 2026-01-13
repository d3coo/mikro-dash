<script lang="ts">
  import { enhance } from '$app/forms';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Plus, Trash2, Printer } from 'lucide-svelte';

  let { data, form } = $props();

  let selectedPackage = $state('');
  let quantity = $state(10);
  let selectedIds = $state<string[]>([]);
  let statusFilter = $state('all');

  let filteredVouchers = $derived(
    statusFilter === 'all'
      ? data.vouchers
      : data.vouchers.filter(v => v.status === statusFilter)
  );

  function toggleSelect(id: string) {
    if (selectedIds.includes(id)) {
      selectedIds = selectedIds.filter(i => i !== id);
    } else {
      selectedIds = [...selectedIds, id];
    }
  }

  function selectAll() {
    if (selectedIds.length === filteredVouchers.length) {
      selectedIds = [];
    } else {
      selectedIds = filteredVouchers.map(v => v.id);
    }
  }

  function formatDate(iso: string): string {
    const date = new Date(iso);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  }

  const statusLabels: Record<string, string> = {
    available: 'متاح',
    used: 'مستخدم',
    expired: 'منتهي'
  };

  const statusColors: Record<string, string> = {
    available: 'bg-green-100 text-green-800',
    used: 'bg-gray-100 text-gray-800',
    expired: 'bg-red-100 text-red-800'
  };
</script>

<div class="space-y-8">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold">الكروت</h1>
      <p class="text-gray-500 mt-1">إنشاء وإدارة كروت الواي فاي</p>
    </div>
    <a href="/vouchers/print?ids={selectedIds.join(',')}" class="inline-block">
      <Button variant="outline" disabled={selectedIds.length === 0}>
        <span>طباعة ({selectedIds.length})</span>
        <Printer class="w-4 h-4" />
      </Button>
    </a>
  </div>

  {#if form?.error}
    <div class="bg-red-50 text-red-800 p-4 rounded-lg">{form.error}</div>
  {/if}

  {#if form?.success}
    <div class="bg-green-50 text-green-800 p-4 rounded-lg">
      تم بنجاح! {form.created ? `تم إنشاء ${form.created} كرت` : ''}
      {form.deleted ? `تم حذف ${form.deleted} كرت` : ''}
    </div>
  {/if}

  <!-- Generate Form -->
  <Card>
    <CardHeader>
      <CardTitle>إنشاء كروت جديدة</CardTitle>
    </CardHeader>
    <CardContent>
      <form method="POST" action="?/generate" use:enhance class="flex flex-wrap gap-4 items-end">
        <div class="flex-1 min-w-[200px]">
          <label for="packageId" class="block text-sm font-medium mb-2">الباقة</label>
          <select
            id="packageId"
            name="packageId"
            bind:value={selectedPackage}
            class="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
            required
          >
            <option value="">اختر الباقة...</option>
            {#each data.packages as pkg}
              <option value={pkg.id}>{pkg.nameAr} - {pkg.priceLE} ج.م</option>
            {/each}
          </select>
        </div>

        <div class="w-32">
          <label for="quantity" class="block text-sm font-medium mb-2">الكمية</label>
          <input
            id="quantity"
            type="number"
            name="quantity"
            bind:value={quantity}
            min="1"
            max="100"
            class="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
            required
          />
        </div>

        <Button type="submit">
          <span>إنشاء</span>
          <Plus class="w-4 h-4" />
        </Button>
      </form>
    </CardContent>
  </Card>

  <!-- Vouchers List -->
  <Card>
    <CardHeader class="flex flex-row items-center justify-between">
      <CardTitle>قائمة الكروت ({filteredVouchers.length})</CardTitle>
      <div class="flex gap-2">
        <select
          bind:value={statusFilter}
          class="p-2 border rounded-lg bg-white dark:bg-gray-800 text-sm"
        >
          <option value="all">الكل</option>
          <option value="available">متاح</option>
          <option value="used">مستخدم</option>
          <option value="expired">منتهي</option>
        </select>

        {#if selectedIds.length > 0}
          <form method="POST" action="?/delete" use:enhance>
            {#each selectedIds as id}
              <input type="hidden" name="ids" value={id} />
            {/each}
            <Button type="submit" variant="destructive" size="sm">
              <span>حذف ({selectedIds.length})</span>
              <Trash2 class="w-4 h-4" />
            </Button>
          </form>
        {/if}
      </div>
    </CardHeader>
    <CardContent>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b">
              <th class="p-3 text-start">
                <input
                  type="checkbox"
                  checked={selectedIds.length === filteredVouchers.length && filteredVouchers.length > 0}
                  onchange={selectAll}
                  class="w-4 h-4"
                />
              </th>
              <th class="p-3 text-start">الكود</th>
              <th class="p-3 text-start">كلمة المرور</th>
              <th class="p-3 text-start">الباقة</th>
              <th class="p-3 text-start">السعر</th>
              <th class="p-3 text-start">الحالة</th>
              <th class="p-3 text-start">تاريخ الإنشاء</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredVouchers as voucher}
              <tr class="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                <td class="p-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(voucher.id)}
                    onchange={() => toggleSelect(voucher.id)}
                    class="w-4 h-4"
                  />
                </td>
                <td class="p-3 font-mono">{voucher.id}</td>
                <td class="p-3 font-mono">{voucher.password}</td>
                <td class="p-3">{voucher.package}</td>
                <td class="p-3">{voucher.priceLE} ج.م</td>
                <td class="p-3">
                  <span class="px-2 py-1 rounded-full text-xs {statusColors[voucher.status]}">
                    {statusLabels[voucher.status]}
                  </span>
                </td>
                <td class="p-3 text-sm text-gray-500">{formatDate(voucher.createdAt)}</td>
              </tr>
            {/each}
          </tbody>
        </table>

        {#if filteredVouchers.length === 0}
          <div class="text-center py-8 text-gray-500">
            لا توجد كروت
          </div>
        {/if}
      </div>
    </CardContent>
  </Card>
</div>
