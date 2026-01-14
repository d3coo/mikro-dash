CREATE TABLE `voucher_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_ar` text NOT NULL,
	`bytes` integer NOT NULL,
	`price_le` integer NOT NULL,
	`profile` text NOT NULL,
	`server` text,
	`code_prefix` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
