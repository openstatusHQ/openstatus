CREATE TABLE `external_service_component` (
	`id` integer PRIMARY KEY NOT NULL,
	`external_service_id` integer NOT NULL,
	`upstream_component_id` text NOT NULL,
	`slug` text NOT NULL,
	`aliases` text DEFAULT (json_array()) NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`group_name` text,
	`position` integer DEFAULT 0 NOT NULL,
	`indicator` text NOT NULL,
	`status` text NOT NULL,
	`first_seen_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`last_seen_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`external_service_id`) REFERENCES `external_service`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `external_service_component_unique_idx` ON `external_service_component` (`external_service_id`,`upstream_component_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `external_service_component_slug_unique_idx` ON `external_service_component` (`external_service_id`,`slug`);--> statement-breakpoint
CREATE INDEX `external_service_component_last_seen_at_idx` ON `external_service_component` (`external_service_id`,`last_seen_at`);--> statement-breakpoint
ALTER TABLE `external_service_incident` ADD `affected_component_ids` text DEFAULT (json_array()) NOT NULL;