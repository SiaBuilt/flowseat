CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`subject` text NOT NULL,
	`action` text NOT NULL,
	`note` text NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `helpful` (
	`uid` text NOT NULL,
	`review_id` text NOT NULL,
	PRIMARY KEY(`uid`, `review_id`)
);
--> statement-breakpoint
CREATE TABLE `places` (
	`id` text PRIMARY KEY NOT NULL,
	`author` text NOT NULL,
	`fingerprint` text NOT NULL,
	`payload` text NOT NULL,
	`status` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `places_fingerprint_unique` ON `places` (`fingerprint`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`uid` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`author` text NOT NULL,
	`place_id` text NOT NULL,
	`kind` text NOT NULL,
	`source_key` text NOT NULL,
	`payload` text NOT NULL,
	`status` text NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_user_kind` ON `reports` (`author`,`place_id`,`kind`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`author` text NOT NULL,
	`place_id` text NOT NULL,
	`payload` text NOT NULL,
	`status` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `saved` (
	`uid` text NOT NULL,
	`place_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`uid`, `place_id`)
);
--> statement-breakpoint
CREATE TABLE `seats` (
	`author` text NOT NULL,
	`place_id` text NOT NULL,
	`status` text NOT NULL,
	`at` integer NOT NULL,
	PRIMARY KEY(`author`, `place_id`)
);
