CREATE TABLE `incidents_to_monitors` (
	`monitor_id` integer NOT NULL,
	`incident_id` integer NOT NULL,
	PRIMARY KEY(`incident_id`, `monitor_id`),
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`incident_id`) REFERENCES `incident`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

DROP INDEX IF EXISTS `incident_update_uuid_unique`;--> statement-breakpoint

ALTER TABLE `incident` RENAME TO `incident_old`;--> statement-breakpoint
ALTER TABLE `incident_update` RENAME TO `incident_update_old`;--> statement-breakpoint

CREATE TABLE `incident` (
  `id` integer PRIMARY KEY NOT NULL,
  `status` text(2) NOT NULL,
  `title` text(256) NOT NULL,
  `created_at` integer DEFAULT (strftime('%s', 'now')),
  `updated_at` integer DEFAULT (strftime('%s', 'now')),
  `workspace_id` integer NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE TABLE `incident_update` (
  `id` integer PRIMARY KEY NOT NULL,
  `status` text(2) NOT NULL,
  `date` integer NOT NULL,
  `message` text NOT NULL,
  `created_at` integer DEFAULT (strftime('%s', 'now')),
  `updated_at` integer DEFAULT (strftime('%s', 'now')),
  `incident_id` integer NOT NULL,
  FOREIGN KEY (`incident_id`) REFERENCES `incident`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

DROP INDEX IF EXISTS `incident_update_uuid_unique`;