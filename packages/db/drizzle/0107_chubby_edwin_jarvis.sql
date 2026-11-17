ALTER TABLE `monitor_maintenance_window` ADD `maintenance_id` integer REFERENCES maintenance(id) ON DELETE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX `monitor_maintenance_window_maintenance_id_unique` ON `monitor_maintenance_window` (`maintenance_id`);--> statement-breakpoint
INSERT INTO `monitor_maintenance_window` (`workspace_id`, `title`, `mode`, `from`, `to`, `maintenance_id`, `created_by`, `updated_by`, `created_at`, `updated_at`)
SELECT m.`workspace_id`, m.`title`, 'pause', m.`from`, m.`to`, m.`id`, m.`created_by`, m.`updated_by`,
  coalesce(m.`created_at`, cast(strftime('%s', 'now') AS integer)),
  coalesce(m.`updated_at`, cast(strftime('%s', 'now') AS integer))
FROM `maintenance` m
WHERE m.`monitor_maintenance_window_id` IS NULL
  AND m.`workspace_id` IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM `maintenance_to_page_component` l
    INNER JOIN `page_component` pc ON pc.`id` = l.`page_component_id`
    INNER JOIN `monitor` mo ON mo.`id` = pc.`monitor_id`
    WHERE l.`maintenance_id` = m.`id` AND mo.`deleted_at` IS NULL
  );--> statement-breakpoint
INSERT INTO `monitor_maintenance_window_to_monitor` (`monitor_maintenance_window_id`, `monitor_id`)
SELECT DISTINCT w.`id`, pc.`monitor_id`
FROM `monitor_maintenance_window` w
INNER JOIN `maintenance_to_page_component` l ON l.`maintenance_id` = w.`maintenance_id`
INNER JOIN `page_component` pc ON pc.`id` = l.`page_component_id`
INNER JOIN `monitor` mo ON mo.`id` = pc.`monitor_id`
WHERE w.`maintenance_id` IS NOT NULL AND mo.`deleted_at` IS NULL;--> statement-breakpoint
UPDATE `maintenance`
SET `monitor_maintenance_window_id` = (
  SELECT w.`id` FROM `monitor_maintenance_window` w WHERE w.`maintenance_id` = `maintenance`.`id`
)
WHERE `monitor_maintenance_window_id` IS NULL
  AND EXISTS (
    SELECT 1 FROM `monitor_maintenance_window` w WHERE w.`maintenance_id` = `maintenance`.`id`
  );
