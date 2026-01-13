<script lang="ts">
  import { enhance } from '$app/forms';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Save, Wifi } from 'lucide-svelte';

  let { data, form } = $props();

  let settings = $state({ ...data.settings });
</script>

<div class="space-y-8">
  <div>
    <h1 class="text-3xl font-bold">الإعدادات</h1>
    <p class="text-gray-500 mt-1">إعدادات الاتصال والتطبيق</p>
  </div>

  {#if form?.error}
    <div class="bg-red-50 text-red-800 p-4 rounded-lg">{form.error}</div>
  {/if}

  {#if form?.success}
    <div class="bg-green-50 text-green-800 p-4 rounded-lg">تم حفظ الإعدادات بنجاح</div>
  {/if}

  {#if form?.testResult}
    <div class="p-4 rounded-lg {form.testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}">
      {form.testResult.message}
    </div>
  {/if}

  <form method="POST" action="?/save" use:enhance class="space-y-6">
    <!-- Router Connection -->
    <Card>
      <CardHeader>
        <CardTitle>اتصال الراوتر</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="mikrotik_host" class="block text-sm font-medium mb-2">عنوان IP</label>
            <input
              type="text"
              id="mikrotik_host"
              name="mikrotik_host"
              bind:value={settings.mikrotik_host}
              class="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
              placeholder="192.168.1.109"
            />
          </div>

          <div>
            <label for="mikrotik_user" class="block text-sm font-medium mb-2">اسم المستخدم</label>
            <input
              type="text"
              id="mikrotik_user"
              name="mikrotik_user"
              bind:value={settings.mikrotik_user}
              class="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
              placeholder="admin"
            />
          </div>

          <div>
            <label for="mikrotik_pass" class="block text-sm font-medium mb-2">كلمة المرور</label>
            <input
              type="password"
              id="mikrotik_pass"
              name="mikrotik_pass"
              bind:value={settings.mikrotik_pass}
              class="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
            />
          </div>

          <div>
            <label for="hotspot_server" class="block text-sm font-medium mb-2">سيرفر Hotspot</label>
            <input
              type="text"
              id="hotspot_server"
              name="hotspot_server"
              bind:value={settings.hotspot_server}
              class="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
              placeholder="guest-hotspot"
            />
          </div>
        </div>

        <div class="pt-2">
          <form method="POST" action="?/testConnection" use:enhance class="inline">
            <Button type="submit" variant="outline">
              <span>اختبار الاتصال</span>
              <Wifi class="w-4 h-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>

    <!-- Business Settings -->
    <Card>
      <CardHeader>
        <CardTitle>إعدادات العمل</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="business_name" class="block text-sm font-medium mb-2">اسم العمل</label>
            <input
              type="text"
              id="business_name"
              name="business_name"
              bind:value={settings.business_name}
              class="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
              placeholder="AboYassen WiFi"
            />
          </div>

          <div>
            <label for="voucher_prefix" class="block text-sm font-medium mb-2">بادئة الكروت</label>
            <input
              type="text"
              id="voucher_prefix"
              name="voucher_prefix"
              bind:value={settings.voucher_prefix}
              class="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
              placeholder="ABO"
              maxlength="5"
            />
          </div>
        </div>
      </CardContent>
    </Card>

    <div class="flex justify-end">
      <Button type="submit">
        <span>حفظ الإعدادات</span>
        <Save class="w-4 h-4" />
      </Button>
    </div>
  </form>
</div>
