ALTER TABLE `monitor` ADD `timeout` integer DEFAULT 45000 NOT NULL;--> statement-breakpoint
ALTER TABLE `monitor` ADD `degraded_after` integer;