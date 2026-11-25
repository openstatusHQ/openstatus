PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_page_subscriber` (
	`id` integer PRIMARY KEY NOT NULL,
	`email` text,
	`page_id` integer NOT NULL,
	`channel_type` text DEFAULT 'email' NOT NULL,
	`webhook_url` text,
	`channel_config` text,
	`slack_channel_id` text,
	`source` text DEFAULT 'self_signup' NOT NULL,
	`name` text,
	`token` text,
	`accepted_at` integer,
	`expires_at` integer,
	`unsubscribed_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`page_id`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "page_subscriber_channel_check" CHECK(("__new_page_subscriber"."channel_type" = 'email' AND "__new_page_subscriber"."email" IS NOT NULL AND "__new_page_subscriber"."webhook_url" IS NULL) OR ("__new_page_subscriber"."channel_type" = 'webhook' AND "__new_page_subscriber"."webhook_url" IS NOT NULL AND "__new_page_subscriber"."email" IS NULL) OR ("__new_page_subscriber"."channel_type" = 'slack' AND "__new_page_subscriber"."slack_channel_id" IS NOT NULL AND "__new_page_subscriber"."email" IS NULL AND "__new_page_subscriber"."webhook_url" IS NULL))
);
--> statement-breakpoint
INSERT INTO `__new_page_subscriber`("id", "email", "page_id", "channel_type", "webhook_url", "channel_config", "slack_channel_id", "source", "name", "token", "accepted_at", "expires_at", "unsubscribed_at", "created_at", "updated_at") SELECT "id", "email", "page_id", "channel_type", "webhook_url", "channel_config", NULL, "source", "name", "token", "accepted_at", "expires_at", "unsubscribed_at", "created_at", "updated_at" FROM `page_subscriber`;--> statement-breakpoint
DROP TABLE `page_subscriber`;--> statement-breakpoint
ALTER TABLE `__new_page_subscriber` RENAME TO `page_subscriber`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_page_subscriber_email_page_active` ON `page_subscriber` (LOWER("email"), `page_id`) WHERE "page_subscriber"."unsubscribed_at" IS NULL AND "page_subscriber"."channel_type" = 'email';--> statement-breakpoint
CREATE UNIQUE INDEX `idx_page_subscriber_webhook_page_active` ON `page_subscriber` (LOWER("webhook_url"), `page_id`) WHERE "page_subscriber"."unsubscribed_at" IS NULL AND "page_subscriber"."channel_type" = 'webhook';--> statement-breakpoint
CREATE UNIQUE INDEX `idx_page_subscriber_slack_channel_page_active` ON `page_subscriber` (`slack_channel_id`, `page_id`) WHERE "page_subscriber"."unsubscribed_at" IS NULL AND "page_subscriber"."channel_type" = 'slack';
