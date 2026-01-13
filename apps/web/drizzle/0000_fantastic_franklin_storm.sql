CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vouchers` (
	`id` text PRIMARY KEY NOT NULL,
	`password` text NOT NULL,
	`package` text NOT NULL,
	`price_le` integer NOT NULL,
	`bytes_limit` integer NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`synced` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`used_at` text
);
