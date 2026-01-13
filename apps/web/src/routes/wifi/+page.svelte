<script lang="ts">
  import { Card, CardContent } from '$lib/components/ui/card';
  import { Wifi } from 'lucide-svelte';
</script>

<div class="space-y-8">
  <div>
    <h1 class="text-3xl font-bold">الواي فاي</h1>
    <p class="text-gray-500 mt-1">إدارة شبكات الواي فاي</p>
  </div>

  <Card>
    <CardContent class="py-16 text-center">
      <Wifi class="w-16 h-16 mx-auto text-gray-300 mb-4" />
      <p class="text-gray-500">قريباً...</p>
    </CardContent>
  </Card>
</div>
