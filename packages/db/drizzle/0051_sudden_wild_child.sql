CREATE TABLE `viewer` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text,
	`email` text,
	`emailVerified` integer,
	`image` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `viewer_email_unique` ON `viewer` (`email`);--> statement-breakpoint
CREATE TABLE `viewer_accounts` (
	`viewer_id` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`providerAccountId` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	PRIMARY KEY(`provider`, `providerAccountId`),
	FOREIGN KEY (`viewer_id`) REFERENCES `viewer`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `viewer_session` (
	`session_token` text PRIMARY KEY NOT NULL,
	`viewer_id` integer NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`viewer_id`) REFERENCES `viewer`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `viewers_to_pages` (
	`viewer_id` integer NOT NULL,
	`page_id` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	PRIMARY KEY(`viewer_id`, `page_id`),
	FOREIGN KEY (`viewer_id`) REFERENCES `viewer`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`page_id`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `page` ADD `access_type` text DEFAULT 'public';--> statement-breakpoint
ALTER TABLE `page` ADD `auth_email_domains` text;--> statement-breakpoint
-- NOTE: manual migration to set the access type based on the password column
UPDATE `page` SET `access_type` = 'password' WHERE `password` IS NOT NULL AND `password` != '' AND `password_protected` = 1;