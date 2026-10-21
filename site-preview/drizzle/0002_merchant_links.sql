CREATE TABLE `merchant_links` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`place_id` text NOT NULL,
	`created_by` text NOT NULL,
	`fields` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer
);
