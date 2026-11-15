CREATE TABLE `monitor_sla_excused_window_to_monitor` (
	`monitor_sla_excused_window_id` integer NOT NULL,
	`monitor_id` integer NOT NULL,
	PRIMARY KEY(`monitor_sla_excused_window_id`, `monitor_id`),
	FOREIGN KEY (`monitor_sla_excused_window_id`) REFERENCES `monitor_sla_excused_window`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `monitor_sla_excused_window_to_monitor_monitor_id_idx` ON `monitor_sla_excused_window_to_monitor` (`monitor_id`);