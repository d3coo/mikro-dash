/**
 * Export SQLite data to JSON for Convex migration
 * Run: bun run scripts/export-sqlite.ts
 */

import { createClient } from '@libsql/client';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const dbPath = resolve(process.cwd(), 'data.db');
console.log(`[Export] Reading from: ${dbPath}`);

const client = createClient({ url: `file:${dbPath}` });

async function exportData() {
  console.log('[Export] Starting export...');

  const data: Record<string, unknown[]> = {};

  // Phase 1: Independent tables (no foreign keys)
  console.log('[Export] Exporting settings...');
  data.settings = (await client.execute('SELECT * FROM settings')).rows;

  console.log('[Export] Exporting packages...');
  data.packages = (await client.execute('SELECT * FROM packages')).rows;

  console.log('[Export] Exporting ps_stations...');
  data.psStations = (await client.execute('SELECT * FROM ps_stations')).rows;

  console.log('[Export] Exporting ps_menu_items...');
  data.psMenuItems = (await client.execute('SELECT * FROM ps_menu_items')).rows;

  console.log('[Export] Exporting expenses...');
  data.expenses = (await client.execute('SELECT * FROM expenses')).rows;

  console.log('[Export] Exporting printed_vouchers...');
  data.printedVouchers = (await client.execute('SELECT * FROM printed_vouchers')).rows;

  console.log('[Export] Exporting voucher_usage...');
  data.voucherUsage = (await client.execute('SELECT * FROM voucher_usage')).rows;

  console.log('[Export] Exporting unified_daily_stats...');
  data.unifiedDailyStats = (await client.execute('SELECT * FROM unified_daily_stats')).rows;

  // Phase 2: Dependent tables (need ID mapping)
  console.log('[Export] Exporting ps_sessions...');
  data.psSessions = (await client.execute('SELECT * FROM ps_sessions')).rows;

  console.log('[Export] Exporting ps_session_orders...');
  data.psSessionOrders = (await client.execute('SELECT * FROM ps_session_orders')).rows;

  console.log('[Export] Exporting ps_session_charges...');
  data.psSessionCharges = (await client.execute('SELECT * FROM ps_session_charges')).rows;

  console.log('[Export] Exporting ps_session_segments...');
  data.psSessionSegments = (await client.execute('SELECT * FROM ps_session_segments')).rows;

  console.log('[Export] Exporting ps_session_transfers...');
  data.psSessionTransfers = (await client.execute('SELECT * FROM ps_session_transfers')).rows;

  console.log('[Export] Exporting fnb_sales...');
  data.fnbSales = (await client.execute('SELECT * FROM fnb_sales')).rows;

  // Write to file
  const outputPath = resolve(process.cwd(), 'migration-data.json');
  writeFileSync(outputPath, JSON.stringify(data, null, 2));

  // Print summary
  console.log('\n[Export] Summary:');
  for (const [table, rows] of Object.entries(data)) {
    console.log(`  ${table}: ${(rows as unknown[]).length} rows`);
  }

  console.log(`\n[Export] Data exported to: ${outputPath}`);
}

exportData().catch((err) => {
  console.error('[Export] Error:', err);
  process.exit(1);
});
