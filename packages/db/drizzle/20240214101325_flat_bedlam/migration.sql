DROP INDEX IF EXISTS `incident_id_monitor_id_started_at_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `incident_monitor_id_started_at_unique` ON `incident` (`monitor_id`,`started_at`);