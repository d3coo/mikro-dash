<script lang="ts">
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Users, Ticket, Banknote, Wifi, WifiOff } from 'lucide-svelte';

  let { data } = $props();
</script>

<div class="space-y-8">
  <div>
    <h1 class="text-3xl font-bold">{data.businessName}</h1>
    <p class="text-gray-500 mt-1">لوحة التحكم الرئيسية</p>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    <!-- Active Users -->
    <Card>
      <CardHeader class="flex flex-row items-center justify-between pb-2">
        <CardTitle class="text-sm font-medium text-gray-500">المستخدمين النشطين</CardTitle>
        <Users class="w-5 h-5 text-primary" />
      </CardHeader>
      <CardContent>
        <div class="text-3xl font-bold">{data.stats.activeUsers}</div>
        <p class="text-xs text-gray-500 mt-1">متصل الآن</p>
      </CardContent>
    </Card>

    <!-- Available Vouchers -->
    <Card>
      <CardHeader class="flex flex-row items-center justify-between pb-2">
        <CardTitle class="text-sm font-medium text-gray-500">الكروت المتاحة</CardTitle>
        <Ticket class="w-5 h-5 text-success" />
      </CardHeader>
      <CardContent>
        <div class="text-3xl font-bold">{data.stats.availableVouchers}</div>
        <p class="text-xs text-gray-500 mt-1">جاهزة للبيع</p>
      </CardContent>
    </Card>

    <!-- Today's Revenue -->
    <Card>
      <CardHeader class="flex flex-row items-center justify-between pb-2">
        <CardTitle class="text-sm font-medium text-gray-500">إيراد اليوم</CardTitle>
        <Banknote class="w-5 h-5 text-warning" />
      </CardHeader>
      <CardContent>
        <div class="text-3xl font-bold">{data.stats.todayRevenue} ج.م</div>
        <p class="text-xs text-gray-500 mt-1">المبيعات اليوم</p>
      </CardContent>
    </Card>

    <!-- Router Status -->
    <Card>
      <CardHeader class="flex flex-row items-center justify-between pb-2">
        <CardTitle class="text-sm font-medium text-gray-500">حالة الراوتر</CardTitle>
        {#if data.stats.routerConnected}
          <Wifi class="w-5 h-5 text-success" />
        {:else}
          <WifiOff class="w-5 h-5 text-danger" />
        {/if}
      </CardHeader>
      <CardContent>
        <div class="text-3xl font-bold">
          {#if data.stats.routerConnected}
            <span class="text-success">متصل</span>
          {:else}
            <span class="text-danger">غير متصل</span>
          {/if}
        </div>
        <p class="text-xs text-gray-500 mt-1">MikroTik</p>
      </CardContent>
    </Card>
  </div>
</div>
