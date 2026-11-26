CREATE TABLE `check` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`regions` text DEFAULT '' NOT NULL,
	`url` text(4096) NOT NULL,
	`headers` text DEFAULT '',
	`body` text DEFAULT '',
	`method` text DEFAULT 'GET',
	`count_requests` integer DEFAULT 1,
	`workspace_id` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action
);
