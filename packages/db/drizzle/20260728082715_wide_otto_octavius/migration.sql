CREATE TABLE `workspace_sso_domain` (
	`id` integer PRIMARY KEY NOT NULL,
	`workspace_id` integer NOT NULL,
	`domain` text NOT NULL,
	`verified_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_sso_domain_domain_unique` ON `workspace_sso_domain` (`domain`);--> statement-breakpoint
CREATE INDEX `workspace_sso_domain_workspace_id_idx` ON `workspace_sso_domain` (`workspace_id`);--> statement-breakpoint
ALTER TABLE `workspace` ADD `workos_organization_id` text;--> statement-breakpoint
ALTER TABLE `workspace` ADD `sso_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_workos_organization_id_unique` ON `workspace` (`workos_organization_id`);