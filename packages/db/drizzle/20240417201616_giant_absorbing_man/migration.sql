ALTER TABLE workspace ADD `dsn` text;--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_id_dsn_unique` ON `workspace` (`id`,`dsn`);