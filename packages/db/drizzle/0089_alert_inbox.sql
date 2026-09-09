CREATE TABLE `alert_inbox` (
	`id` integer PRIMARY KEY NOT NULL,
	`alert_source_id` integer NOT NULL,
	`dedup_key` text NOT NULL,
	`raw_body` text NOT NULL,
	`content_type` text,
	`external_id` text,
	`fingerprint` text,
	`processing_status` text DEFAULT 'pending' NOT NULL,
	`outcome` text,
	`incident_id` integer,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`deadline_at` integer NOT NULL,
	`locked_by` text,
	`locked_until` integer,
	`processed_at` integer,
	`last_error` text,
	`received_at` integer NOT NULL,
	FOREIGN KEY (`alert_source_id`) REFERENCES `alert_source`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`incident_id`) REFERENCES `incident`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alert_inbox_dedup_key_idx` ON `alert_inbox` (`dedup_key`);--> statement-breakpoint
CREATE INDEX `alert_inbox_claim_idx` ON `alert_inbox` (`next_attempt_at`) WHERE "alert_inbox"."processing_status" = 'pending';--> statement-breakpoint
CREATE INDEX `alert_inbox_ordering_idx` ON `alert_inbox` (`alert_source_id`,`fingerprint`) WHERE "alert_inbox"."processing_status" = 'pending';--> statement-breakpoint
CREATE INDEX `alert_inbox_retention_idx` ON `alert_inbox` (`processing_status`,`received_at`);--> statement-breakpoint
CREATE TABLE `alert_dead_letter` (
	`id` integer PRIMARY KEY NOT NULL,
	`inbox_id` integer NOT NULL,
	`alert_source_id` integer NOT NULL,
	`dedup_key` text NOT NULL,
	`raw_body` text NOT NULL,
	`content_type` text,
	`external_id` text,
	`fingerprint` text,
	`attempts` integer NOT NULL,
	`final_error` text,
	`received_at` integer NOT NULL,
	`died_at` integer NOT NULL,
	FOREIGN KEY (`alert_source_id`) REFERENCES `alert_source`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alert_dead_letter_dedup_key_idx` ON `alert_dead_letter` (`dedup_key`);--> statement-breakpoint
CREATE INDEX `alert_dead_letter_source_died_at_idx` ON `alert_dead_letter` (`alert_source_id`,`died_at`);
