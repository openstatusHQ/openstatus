CREATE TABLE `application` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text,
	`dsn` text,
	`workspace_id` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_dsn_unique` ON `application` (`dsn`);