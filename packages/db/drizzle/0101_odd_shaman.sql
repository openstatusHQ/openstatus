ALTER TABLE `playbook` RENAME COLUMN "type" TO "slug";--> statement-breakpoint
DROP INDEX `playbook_workspace_id_type_idx`;--> statement-breakpoint
ALTER TABLE `playbook` ADD `title` text;--> statement-breakpoint
ALTER TABLE `playbook` ADD `description` text;--> statement-breakpoint
CREATE UNIQUE INDEX `playbook_workspace_id_slug_idx` ON `playbook` (`workspace_id`,`slug`);