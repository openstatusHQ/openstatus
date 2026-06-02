ALTER TABLE `external_service_component` ADD `slug` text NOT NULL;--> statement-breakpoint
ALTER TABLE `external_service_component` ADD `aliases` text DEFAULT (json_array()) NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `external_service_component_slug_unique_idx` ON `external_service_component` (`external_service_id`,`slug`);--> statement-breakpoint
ALTER TABLE `external_service_incident` ADD `affected_component_ids` text DEFAULT (json_array()) NOT NULL;