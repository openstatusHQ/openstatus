DROP INDEX IF EXISTS `incident_monitor_id_started_at_unique`;--> statement-breakpoint
DROP INDEX IF EXISTS `composite_incident_new_id_started_at_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `incident_id_monitor_id_started_at_unique` ON `incident` (`id`,`monitor_id`,`started_at`);