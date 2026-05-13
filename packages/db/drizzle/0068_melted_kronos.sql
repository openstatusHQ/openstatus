CREATE TABLE `external_service` (
	`id` integer PRIMARY KEY NOT NULL,
	`slug` text(64) NOT NULL,
	`aliases` text DEFAULT (json_array()) NOT NULL,
	`name` text(256) NOT NULL,
	`url` text NOT NULL,
	`status_page_url` text NOT NULL,
	`provider` text NOT NULL,
	`industry` text NOT NULL,
	`description` text,
	`api_config` text,
	`deleted_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `external_service_slug_unique` ON `external_service` (`slug`);--> statement-breakpoint
CREATE INDEX `external_service_deleted_at_idx` ON `external_service` (`deleted_at`);