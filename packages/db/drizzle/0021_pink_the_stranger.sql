DROP INDEX IF EXISTS `incident_id_monitor_id_started_at_unique`;--> statement-breakpoint
DROP INDEX IF EXISTS `incident_monitor_id_started_at_unique`;--> statement-breakpoint
ALTER TABLE `user` RENAME COLUMN `id` TO `primaryKey`;--> statement-breakpoint
ALTER TABLE `incident` ALTER COLUMN acknowledged_by TO acknowledged_by INT  REFERENCES user(primaryKey);--> statement-breakpoint
ALTER TABLE `incident` ALTER COLUMN resolved_by TO resolved_by INT  REFERENCES user(primaryKey);--> statement-breakpoint
ALTER TABLE `users_to_workspaces` ALTER COLUMN user_id TO user_id INT  REFERENCES user(primaryKey);--> statement-breakpoint
CREATE UNIQUE INDEX `incident_monitor_id_started_at_unique` ON `incident` (`monitor_id`,`started_at`);


