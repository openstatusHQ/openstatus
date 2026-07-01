CREATE TABLE `monitor_tag` (
	`id` integer PRIMARY KEY NOT NULL,
	`workspace_id` integer NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `monitor_tag_to_monitor` (
	`monitor_id` integer NOT NULL,
	`monitor_tag_id` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	PRIMARY KEY(`monitor_id`, `monitor_tag_id`),
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`monitor_tag_id`) REFERENCES `monitor_tag`(`id`) ON UPDATE no action ON DELETE cascade
);
