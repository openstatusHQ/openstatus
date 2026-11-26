DROP TABLE IF EXISTS `page_subscriber`;
--> statement-breakpoint

CREATE TABLE `page_subscriber` (
	`id` integer PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`page_id` integer NOT NULL,
	`token` text,
	`accepted_at` integer,
	`expires_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`page_id`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE no action
);
