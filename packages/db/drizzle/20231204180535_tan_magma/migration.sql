CREATE TABLE `invitation` (
	`id` integer PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`workspace_id` integer NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`accepted_at` integer
);
--> statement-breakpoint
ALTER TABLE users_to_workspaces ADD `role` text DEFAULT 'owner' NOT NULL;