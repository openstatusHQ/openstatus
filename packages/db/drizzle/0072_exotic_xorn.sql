CREATE TABLE `external_service_incident` (
	`id` integer PRIMARY KEY NOT NULL,
	`external_service_id` integer NOT NULL,
	`provider_incident_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`impact` text,
	`shortlink` text,
	`started_at` integer,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	`raw_payload` text,
	`raw_payload_purged_at` integer,
	`first_seen_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`last_seen_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`external_service_id`) REFERENCES `external_service`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `external_service_incident_unique_idx` ON `external_service_incident` (`external_service_id`,`provider_incident_id`);--> statement-breakpoint
CREATE INDEX `external_service_incident_started_at_idx` ON `external_service_incident` (`external_service_id`,`started_at`);