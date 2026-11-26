CREATE TABLE `incident_new` (
    `id` integer PRIMARY KEY NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'triage' NOT NULL,
	`monitor_id` integer,
	`workspace_id` integer,
	`started_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`acknowledged_at` integer,
	`acknowledged_by` integer,
	`resolved_at` integer,
	`resolved_by` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE set default,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`acknowledged_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resolved_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `composite_incident_new_id_started_at_unique` ON `incident_new` (`id`,`started_at`);
--> statement-breakpoint
INSERT INTO incident_new(`id`,`title`,`summary`,`status`,`monitor_id`,`workspace_id`,`started_at`,`acknowledged_at`,`acknowledged_by`,`resolved_at`,`resolved_by`,`created_at`,`updated_at`) SELECT * FROM incident;
--> statement-breakpoint
DROP TABLE incident;
--> statement-breakpoint
ALTER TABLE incident_new RENAME TO incident;