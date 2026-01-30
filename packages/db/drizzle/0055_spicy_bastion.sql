PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_page_component` (
	`id` integer PRIMARY KEY NOT NULL,
	`workspace_id` integer NOT NULL,
	`page_id` integer NOT NULL,
	`type` text DEFAULT 'monitor' NOT NULL,
	`monitor_id` integer,
	`name` text NOT NULL,
	`description` text,
	`order` integer DEFAULT 0,
	`group_id` integer,
	`group_order` integer DEFAULT 0,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_id`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `page_component_groups`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "page_component_type_check" CHECK("__new_page_component"."type" = 'monitor' AND "__new_page_component"."monitor_id" IS NOT NULL OR "__new_page_component"."type" = 'static' AND "__new_page_component"."monitor_id" IS NULL)
);
--> statement-breakpoint
INSERT INTO `__new_page_component`("id", "workspace_id", "page_id", "type", "monitor_id", "name", "description", "order", "group_id", "group_order", "created_at", "updated_at") SELECT "id", "workspace_id", "page_id", "type", "monitor_id", "name", "description", "order", "group_id", "group_order", "created_at", "updated_at" FROM `page_component`;--> statement-breakpoint
DROP TABLE `page_component`;--> statement-breakpoint
ALTER TABLE `__new_page_component` RENAME TO `page_component`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `page_component_page_id_monitor_id_unique` ON `page_component` (`page_id`,`monitor_id`);