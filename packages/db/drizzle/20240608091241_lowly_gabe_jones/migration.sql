CREATE TABLE `maintenance` (
	`id` integer PRIMARY KEY NOT NULL,
	`title` text(256) NOT NULL,
	`message` text NOT NULL,
	`from` integer NOT NULL,
	`to` integer NOT NULL,
	`workspace_id` integer,
	`page_id` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`page_id`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `maintenance_to_monitor` (
	`monitor_id` integer NOT NULL,
	`maintenance_id` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	PRIMARY KEY(`maintenance_id`, `monitor_id`),
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`maintenance_id`) REFERENCES `maintenance`(`id`) ON UPDATE no action ON DELETE cascade
);
