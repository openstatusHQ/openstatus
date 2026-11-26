PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_page_subscriber` (
	`id` integer PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`page_id` integer NOT NULL,
	`token` text,
	`accepted_at` integer,
	`expires_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`page_id`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_page_subscriber`("id", "email", "page_id", "token", "accepted_at", "expires_at", "created_at", "updated_at") SELECT "id", "email", "page_id", "token", "accepted_at", "expires_at", "created_at", "updated_at" FROM `page_subscriber`;--> statement-breakpoint
DROP TABLE `page_subscriber`;--> statement-breakpoint
ALTER TABLE `__new_page_subscriber` RENAME TO `page_subscriber`;--> statement-breakpoint
PRAGMA foreign_keys=ON;