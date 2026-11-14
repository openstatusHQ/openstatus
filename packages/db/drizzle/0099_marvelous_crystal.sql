ALTER TABLE `monitor_sla_policy` ADD `incident_sla_policy_id` integer REFERENCES incident_sla_policy(id) ON DELETE set null;--> statement-breakpoint
CREATE UNIQUE INDEX `monitor_sla_policy_incident_sla_policy_id_idx` ON `monitor_sla_policy` (`incident_sla_policy_id`);--> statement-breakpoint
ALTER TABLE `monitor_sla_policy_terms` ADD `credit_schedule` text;--> statement-breakpoint
ALTER TABLE `monitor_sla_sealed_month` ADD `credit_schedule` text;--> statement-breakpoint
ALTER TABLE `monitor_sla_sealed_month` ADD `credit_pct` real;--> statement-breakpoint
ALTER TABLE `monitor_sla_sealed_month` ADD `credit_steps` integer;--> statement-breakpoint
ALTER TABLE `incident_sla_policy` ADD `credit_per_miss_pct` real;