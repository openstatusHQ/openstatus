CREATE TABLE `integration` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text(256) NOT NULL,
	`workspace_id` integer,
	`credential` text,
	`external_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	`data` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action
);
