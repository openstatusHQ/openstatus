CREATE TABLE `api_key` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`prefix` text NOT NULL,
	`hashed_token` text NOT NULL,
	`workspace_id` integer NOT NULL,
	`created_by_id` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`expires_at` integer,
	`last_used_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_key_hashed_token_unique` ON `api_key` (`hashed_token`);--> statement-breakpoint
CREATE INDEX `api_key_prefix_idx` ON `api_key` (`prefix`);