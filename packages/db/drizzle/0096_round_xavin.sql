CREATE TABLE `monitor_heartbeat_state` (
	`monitor_id` integer PRIMARY KEY NOT NULL,
	`last_ping_at` integer,
	`last_ping_kind` text DEFAULT 'success' NOT NULL,
	`next_due_at` integer,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `monitor_heartbeat_state_next_due_at_idx` ON `monitor_heartbeat_state` (`next_due_at`);--> statement-breakpoint
ALTER TABLE `monitor` ADD `heartbeat_token` text;--> statement-breakpoint
ALTER TABLE `monitor` ADD `heartbeat_period` integer;--> statement-breakpoint
ALTER TABLE `monitor` ADD `heartbeat_grace` integer;--> statement-breakpoint
ALTER TABLE `monitor` ADD `heartbeat_cron` text;--> statement-breakpoint
ALTER TABLE `monitor` ADD `heartbeat_tz` text;--> statement-breakpoint
CREATE UNIQUE INDEX `monitor_heartbeat_token_idx` ON `monitor` (`heartbeat_token`) WHERE "monitor"."heartbeat_token" IS NOT NULL;