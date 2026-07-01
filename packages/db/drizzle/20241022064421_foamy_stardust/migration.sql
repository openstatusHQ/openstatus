CREATE TABLE `monitor_run` (
	`id` integer PRIMARY KEY NOT NULL,
	`workspace_id` integer,
	`monitor_id` integer,
	`runned_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE no action
);
