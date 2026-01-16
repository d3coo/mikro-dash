import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';

/**
 * POST /api/migrate - Run database migrations
 */
export const POST: RequestHandler = async () => {
  const results: string[] = [];

  try {
    // Migration 1: Add time_limit column to packages
    try {
      await db.run(sql`ALTER TABLE packages ADD COLUMN time_limit TEXT DEFAULT '1d'`);
      results.push('Added time_limit column to packages');
    } catch (e) {
      const error = e as Error;
      if (error.message.includes('duplicate column')) {
        results.push('time_limit column already exists');
      } else {
        results.push(`time_limit: ${error.message}`);
      }
    }

    // Migration 2: Create voucher_usage table
    try {
      await db.run(sql`
        CREATE TABLE IF NOT EXISTS voucher_usage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          voucher_code TEXT NOT NULL,
          mac_address TEXT NOT NULL,
          device_name TEXT,
          ip_address TEXT,
          first_connected_at INTEGER NOT NULL,
          last_connected_at INTEGER NOT NULL,
          total_bytes INTEGER DEFAULT 0,
          UNIQUE(voucher_code, mac_address)
        )
      `);
      results.push('Created voucher_usage table');
    } catch (e) {
      const error = e as Error;
      results.push(`voucher_usage: ${error.message}`);
    }

    // Migration 3: Create index for faster lookups
    try {
      await db.run(sql`CREATE INDEX IF NOT EXISTS idx_voucher_usage_code ON voucher_usage(voucher_code)`);
      results.push('Created index on voucher_code');
    } catch (e) {
      // Ignore index errors
    }

    return json({
      success: true,
      message: 'Migration completed',
      results
    });
  } catch (error) {
    console.error('Migration error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed',
      results
    }, { status: 500 });
  }
};
