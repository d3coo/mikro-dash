/**
 * Run migration from SQLite to Convex
 *
 * Prerequisites:
 * 1. Run `bun run scripts/export-sqlite.ts` to create migration-data.json
 * 2. Have `convex dev` running or use deployed URL
 *
 * Run: bun run scripts/run-migration.ts
 */

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Load environment variables
const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  }
}

const CONVEX_URL = process.env.PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  console.error('[Migration] PUBLIC_CONVEX_URL not found in .env.local');
  process.exit(1);
}

console.log(`[Migration] Connecting to: ${CONVEX_URL}`);
const client = new ConvexHttpClient(CONVEX_URL);

// Load migration data
const dataPath = resolve(process.cwd(), 'migration-data.json');
if (!existsSync(dataPath)) {
  console.error('[Migration] migration-data.json not found. Run export-sqlite.ts first.');
  process.exit(1);
}

const data = JSON.parse(readFileSync(dataPath, 'utf-8'));

async function migrate() {
  console.log('[Migration] Starting migration...\n');

  // ID maps for foreign key resolution
  let stationIdMap: Record<string, string> = {};
  let sessionIdMap: Record<number, string> = {};
  let menuItemIdMap: Record<number, string> = {};

  // ============= PHASE 1: Independent tables =============
  console.log('=== Phase 1: Independent tables ===\n');

  // Settings
  if (data.settings?.length) {
    console.log(`[Migration] Inserting ${data.settings.length} settings...`);
    const result = await client.mutation(api.migrations.importFromSqlite.insertSettings, {
      items: data.settings,
    });
    console.log(`  ✓ Inserted ${result.inserted} settings`);
  }

  // Packages
  if (data.packages?.length) {
    console.log(`[Migration] Inserting ${data.packages.length} packages...`);
    const result = await client.mutation(api.migrations.importFromSqlite.insertPackages, {
      items: data.packages,
    });
    console.log(`  ✓ Inserted ${result.inserted} packages`);
  }

  // PS Stations
  if (data.psStations?.length) {
    console.log(`[Migration] Inserting ${data.psStations.length} stations...`);
    const result = await client.mutation(api.migrations.importFromSqlite.insertPsStations, {
      items: data.psStations,
    });
    stationIdMap = result.idMap;
    console.log(`  ✓ Inserted ${result.inserted} stations`);
  }

  // PS Menu Items
  if (data.psMenuItems?.length) {
    console.log(`[Migration] Inserting ${data.psMenuItems.length} menu items...`);
    const result = await client.mutation(api.migrations.importFromSqlite.insertPsMenuItems, {
      items: data.psMenuItems,
    });
    menuItemIdMap = result.idMap;
    console.log(`  ✓ Inserted ${result.inserted} menu items`);
  }

  // Expenses
  if (data.expenses?.length) {
    console.log(`[Migration] Inserting ${data.expenses.length} expenses...`);
    const result = await client.mutation(api.migrations.importFromSqlite.insertExpenses, {
      items: data.expenses,
    });
    console.log(`  ✓ Inserted ${result.inserted} expenses`);
  }

  // Printed Vouchers
  if (data.printedVouchers?.length) {
    console.log(`[Migration] Inserting ${data.printedVouchers.length} printed vouchers...`);
    const result = await client.mutation(api.migrations.importFromSqlite.insertPrintedVouchers, {
      items: data.printedVouchers,
    });
    console.log(`  ✓ Inserted ${result.inserted} printed vouchers`);
  }

  // Voucher Usage
  if (data.voucherUsage?.length) {
    console.log(`[Migration] Inserting ${data.voucherUsage.length} voucher usage records...`);
    const result = await client.mutation(api.migrations.importFromSqlite.insertVoucherUsage, {
      items: data.voucherUsage,
    });
    console.log(`  ✓ Inserted ${result.inserted} voucher usage records`);
  }

  // Unified Daily Stats
  if (data.unifiedDailyStats?.length) {
    console.log(`[Migration] Inserting ${data.unifiedDailyStats.length} daily stats...`);
    const result = await client.mutation(api.migrations.importFromSqlite.insertUnifiedDailyStats, {
      items: data.unifiedDailyStats,
    });
    console.log(`  ✓ Inserted ${result.inserted} daily stats`);
  }

  // ============= PHASE 2: Dependent tables =============
  console.log('\n=== Phase 2: Dependent tables ===\n');

  // PS Sessions (depends on stations)
  if (data.psSessions?.length) {
    console.log(`[Migration] Inserting ${data.psSessions.length} sessions...`);
    const result = await client.mutation(api.migrations.importFromSqlite.insertPsSessions, {
      items: data.psSessions,
      stationIdMap,
    });
    sessionIdMap = result.idMap;
    console.log(`  ✓ Inserted ${result.inserted} sessions (${result.skipped} skipped)`);
  }

  // PS Session Orders (depends on sessions, menu items)
  if (data.psSessionOrders?.length) {
    console.log(`[Migration] Inserting ${data.psSessionOrders.length} session orders...`);
    const result = await client.mutation(api.migrations.importFromSqlite.insertPsSessionOrders, {
      items: data.psSessionOrders,
      sessionIdMap,
      menuItemIdMap,
    });
    console.log(`  ✓ Inserted ${result.inserted} orders (${result.skipped} skipped)`);
  }

  // PS Session Charges (depends on sessions)
  if (data.psSessionCharges?.length) {
    console.log(`[Migration] Inserting ${data.psSessionCharges.length} session charges...`);
    const result = await client.mutation(api.migrations.importFromSqlite.insertPsSessionCharges, {
      items: data.psSessionCharges,
      sessionIdMap,
    });
    console.log(`  ✓ Inserted ${result.inserted} charges (${result.skipped} skipped)`);
  }

  // PS Session Segments (depends on sessions)
  if (data.psSessionSegments?.length) {
    console.log(`[Migration] Inserting ${data.psSessionSegments.length} session segments...`);
    const result = await client.mutation(api.migrations.importFromSqlite.insertPsSessionSegments, {
      items: data.psSessionSegments,
      sessionIdMap,
    });
    console.log(`  ✓ Inserted ${result.inserted} segments (${result.skipped} skipped)`);
  }

  // PS Session Transfers (depends on sessions, stations)
  if (data.psSessionTransfers?.length) {
    console.log(`[Migration] Inserting ${data.psSessionTransfers.length} session transfers...`);
    const result = await client.mutation(api.migrations.importFromSqlite.insertPsSessionTransfers, {
      items: data.psSessionTransfers,
      sessionIdMap,
      stationIdMap,
    });
    console.log(`  ✓ Inserted ${result.inserted} transfers (${result.skipped} skipped)`);
  }

  // F&B Sales (depends on menu items)
  if (data.fnbSales?.length) {
    console.log(`[Migration] Inserting ${data.fnbSales.length} F&B sales...`);
    const result = await client.mutation(api.migrations.importFromSqlite.insertFnbSales, {
      items: data.fnbSales,
      menuItemIdMap,
    });
    console.log(`  ✓ Inserted ${result.inserted} sales (${result.skipped} skipped)`);
  }

  console.log('\n[Migration] ✅ Migration complete!');
  console.log('\nVerify data at: https://dashboard.convex.dev');
}

migrate().catch((err) => {
  console.error('\n[Migration] ❌ Error:', err);
  process.exit(1);
});
