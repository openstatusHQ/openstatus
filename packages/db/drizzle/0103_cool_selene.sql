UPDATE `monitor_sla_policy` SET
	`target` = (SELECT t.`target` FROM `monitor_sla_policy_terms` t WHERE t.`monitor_sla_policy_id` = `monitor_sla_policy`.`id` ORDER BY t.`effective_from` DESC LIMIT 1),
	`strict` = (SELECT t.`strict` FROM `monitor_sla_policy_terms` t WHERE t.`monitor_sla_policy_id` = `monitor_sla_policy`.`id` ORDER BY t.`effective_from` DESC LIMIT 1)
WHERE EXISTS (SELECT 1 FROM `monitor_sla_policy_terms` t WHERE t.`monitor_sla_policy_id` = `monitor_sla_policy`.`id`);--> statement-breakpoint
DELETE FROM `incident_event` WHERE `type` IN ('sla_update_missed', 'sla_response_miss_explained', 'sla_resolution_miss_explained');--> statement-breakpoint
DELETE FROM `incident_sla_notice` WHERE `kind` = 'update';--> statement-breakpoint
DROP TABLE `monitor_sla_policy_terms`;--> statement-breakpoint
DROP INDEX `incident_event_system_unique_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `incident_event_system_unique_idx` ON `incident_event` (`incident_id`,`type`,`created_at`) WHERE "incident_event"."type" IN ('sla_response_breached', 'sla_resolution_breached');--> statement-breakpoint
ALTER TABLE `incident` DROP COLUMN `response_miss_reason`;--> statement-breakpoint
ALTER TABLE `incident` DROP COLUMN `resolution_miss_reason`;