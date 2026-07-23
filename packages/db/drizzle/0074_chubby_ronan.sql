DROP INDEX `external_service_component_last_seen_at_idx`;--> statement-breakpoint
ALTER TABLE `external_service_component` DROP COLUMN `last_seen_at`;--> statement-breakpoint
ALTER TABLE `external_service_incident` DROP COLUMN `last_seen_at`;