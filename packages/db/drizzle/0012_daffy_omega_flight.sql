CREATE TABLE `incident` (
	`id` integer PRIMARY KEY NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'triage' NOT NULL,
	`severity` text DEFAULT '' NOT NULL,
	`incident_kind` text DEFAULT 'incident' NOT NULL,
	`created_by` text NOT NULL,
	`service_id` integer,
	`started_at` integer,
	`dectected_at` integer,
	`acknowledged_at` integer,
	`mitigated_at` integer,
	`resolved_at` integer
);
--> statement-breakpoint
CREATE TABLE `service` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`monitor_id` integer
);
