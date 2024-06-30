ALTER TABLE `monitor` ADD `timeout` integer DEFAULT 45 NOT NULL;--> statement-breakpoint
ALTER TABLE `monitor` ADD `degraded_after` integer;