CREATE TABLE `oauth_client` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` text NOT NULL,
	`name` text DEFAULT 'MCP Client' NOT NULL,
	`redirect_uris` text NOT NULL,
	`revoked_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_client_client_id_unique` ON `oauth_client` (`client_id`);--> statement-breakpoint
CREATE TABLE `oauth_session` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`scope` text NOT NULL,
	`state` text,
	`resource` text,
	`code_challenge` text NOT NULL,
	`code_challenge_method` text DEFAULT 'S256' NOT NULL,
	`decided_at` integer,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_client`(`client_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `oauth_session_client_id_idx` ON `oauth_session` (`client_id`);--> statement-breakpoint
CREATE INDEX `oauth_session_expires_at_idx` ON `oauth_session` (`expires_at`);--> statement-breakpoint
CREATE TABLE `oauth_authorization_code` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`hash` text NOT NULL,
	`client_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`workspace_id` integer NOT NULL,
	`scope` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`code_challenge` text NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`grant_id` integer,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_client`(`client_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`grant_id`) REFERENCES `oauth_grant`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_authorization_code_hash_unique` ON `oauth_authorization_code` (`hash`);--> statement-breakpoint
CREATE INDEX `oauth_authorization_code_expires_at_idx` ON `oauth_authorization_code` (`expires_at`);--> statement-breakpoint
CREATE INDEX `oauth_authorization_code_client_id_idx` ON `oauth_authorization_code` (`client_id`);--> statement-breakpoint
CREATE TABLE `oauth_grant` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`workspace_id` integer NOT NULL,
	`scope` text NOT NULL,
	`access_token_hash` text NOT NULL,
	`access_token_expires_at` integer NOT NULL,
	`refresh_token_hash` text NOT NULL,
	`refresh_token_expires_at` integer NOT NULL,
	`previous_refresh_token_hash` text,
	`rotated_at` integer,
	`last_used_at` integer,
	`revoked_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`client_id`) REFERENCES `oauth_client`(`client_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_grant_access_token_hash_unique` ON `oauth_grant` (`access_token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_grant_refresh_token_hash_unique` ON `oauth_grant` (`refresh_token_hash`);--> statement-breakpoint
CREATE INDEX `oauth_grant_workspace_id_idx` ON `oauth_grant` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `oauth_grant_client_id_user_id_idx` ON `oauth_grant` (`client_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `oauth_grant_user_id_idx` ON `oauth_grant` (`user_id`);--> statement-breakpoint
CREATE INDEX `oauth_grant_previous_refresh_token_hash_idx` ON `oauth_grant` (`previous_refresh_token_hash`);--> statement-breakpoint
CREATE INDEX `oauth_grant_refresh_token_expires_at_idx` ON `oauth_grant` (`refresh_token_expires_at`);