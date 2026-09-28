-- Handwritten: drizzle-kit would drop and recreate the table. SQLite rewrites the
-- notification_outbox FK and the index definitions on rename.
ALTER TABLE `incident` RENAME TO `monitor_incident`;--> statement-breakpoint
DROP INDEX `incident_monitor_id_started_at_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `monitor_incident_monitor_id_started_at_unique` ON `monitor_incident` (`monitor_id`,`started_at`);--> statement-breakpoint
DROP INDEX `incident_workspace_id_started_at_idx`;--> statement-breakpoint
CREATE INDEX `monitor_incident_workspace_id_started_at_idx` ON `monitor_incident` (`workspace_id`,`started_at`);--> statement-breakpoint
DROP INDEX `incident_open_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `monitor_incident_open_idx` ON `monitor_incident` (`monitor_id`) WHERE "monitor_incident"."resolved_at" IS NULL;--> statement-breakpoint
-- Frees entity_type "incident" for the managed-incident entity; old ids would collide with it.
UPDATE `audit_log`
SET `action` = 'monitor_' || `action`, `entity_type` = 'monitor_incident'
WHERE `entity_type` = 'incident' AND `action` IN ('incident.update', 'incident.delete');
