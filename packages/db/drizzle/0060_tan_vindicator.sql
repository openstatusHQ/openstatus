CREATE TABLE `feedback` (
	`id` integer PRIMARY KEY NOT NULL,
	`workspace_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`source` text NOT NULL,
	`message` text NOT NULL,
	`type` text,
	`blocker` integer,
	`path` text NOT NULL,
	`metadata` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
