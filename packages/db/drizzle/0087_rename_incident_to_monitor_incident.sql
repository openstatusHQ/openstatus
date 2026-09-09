ALTER TABLE `incident` RENAME TO `monitor_incident`;--> statement-breakpoint
DROP INDEX IF EXISTS `incident_workspace_id_started_at_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `incident_open_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `incident_monitor_id_started_at_unique`;--> statement-breakpoint
CREATE INDEX `monitor_incident_workspace_id_started_at_idx` ON `monitor_incident` (`workspace_id`,`started_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `monitor_incident_open_idx` ON `monitor_incident` (`monitor_id`) WHERE "monitor_incident"."resolved_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `monitor_incident_monitor_id_started_at_unique` ON `monitor_incident` (`monitor_id`,`started_at`);
