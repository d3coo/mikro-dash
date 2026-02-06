/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as expenses from "../expenses.js";
import type * as fnbSales from "../fnbSales.js";
import type * as migrations_importFromSqlite from "../migrations/importFromSqlite.js";
import type * as packages from "../packages.js";
import type * as printTracking from "../printTracking.js";
import type * as psMenuItems from "../psMenuItems.js";
import type * as psSessionOrders from "../psSessionOrders.js";
import type * as psSessions from "../psSessions.js";
import type * as psStations from "../psStations.js";
import type * as settings from "../settings.js";
import type * as unifiedDailyStats from "../unifiedDailyStats.js";
import type * as voucherUsage from "../voucherUsage.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  expenses: typeof expenses;
  fnbSales: typeof fnbSales;
  "migrations/importFromSqlite": typeof migrations_importFromSqlite;
  packages: typeof packages;
  printTracking: typeof printTracking;
  psMenuItems: typeof psMenuItems;
  psSessionOrders: typeof psSessionOrders;
  psSessions: typeof psSessions;
  psStations: typeof psStations;
  settings: typeof settings;
  unifiedDailyStats: typeof unifiedDailyStats;
  voucherUsage: typeof voucherUsage;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
