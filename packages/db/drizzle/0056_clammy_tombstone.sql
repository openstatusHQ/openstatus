CREATE TABLE `page_subscription` (
	`id` integer PRIMARY KEY NOT NULL,
	`page_id` integer NOT NULL,
	`workspace_id` integer NOT NULL,
	`channel_type` text NOT NULL,
	`email` text,
	`webhook_url` text,
	`channel_config` text,
	`token` text NOT NULL,
	`verified_at` integer,
	`expires_at` integer,
	`unsubscribed_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "page_subscription_channel_check" CHECK(("page_subscription"."channel_type" = 'email' AND "page_subscription"."email" IS NOT NULL AND "page_subscription"."webhook_url" IS NULL) OR ("page_subscription"."channel_type" = 'webhook' AND "page_subscription"."webhook_url" IS NOT NULL AND "page_subscription"."email" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `page_subscription_token_unique` ON `page_subscription` (`token`);--> statement-breakpoint
CREATE INDEX `idx_page_subscription_page_id` ON `page_subscription` (`page_id`);--> statement-breakpoint
CREATE INDEX `idx_page_subscription_workspace_id` ON `page_subscription` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_page_subscription_verified` ON `page_subscription` (`verified_at`);--> statement-breakpoint
CREATE INDEX `idx_page_subscription_unsubscribed` ON `page_subscription` (`unsubscribed_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_page_subscription_email_page_active` ON `page_subscription` (LOWER("email"),`page_id`) WHERE "page_subscription"."unsubscribed_at" IS NULL AND "page_subscription"."channel_type" = 'email';--> statement-breakpoint
CREATE UNIQUE INDEX `idx_page_subscription_webhook_page_active` ON `page_subscription` (`webhook_url`,`page_id`) WHERE "page_subscription"."unsubscribed_at" IS NULL AND "page_subscription"."channel_type" = 'webhook';--> statement-breakpoint
CREATE TABLE `page_subscription_to_page_component` (
	`page_subscription_id` integer NOT NULL,
	`page_component_id` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	PRIMARY KEY(`page_subscription_id`, `page_component_id`),
	FOREIGN KEY (`page_subscription_id`) REFERENCES `page_subscription`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_component_id`) REFERENCES `page_component`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
/*
 * Data Migration: page_subscriber → page_subscription
 *
 * This migrates all existing page subscribers to the new multi-channel subscription system.
 *
 * Key changes:
 * - accepted_at → verified_at
 * - All subscriptions set to channel_type = 'email'
 * - Existing tokens preserved (verification/management links continue working!)
 * - workspace_id populated from page table
 * - Empty junction table = entire page subscription (no component filtering)
 *
 * Notes:
 * - Skips records where page or workspace doesn't exist
 * - Preserves all timestamps (verified, unsubscribed, created)
 * - Preserves existing tokens (no broken links!)
 * - Handles duplicates by email+page (keeps oldest)
 * - Generates new token only if existing token is NULL
 */

INSERT INTO `page_subscription` (
  `page_id`,
  `workspace_id`,
  `channel_type`,
  `email`,
  `webhook_url`,
  `token`,
  `verified_at`,
  `expires_at`,
  `unsubscribed_at`,
  `created_at`,
  `updated_at`
)
SELECT
  ps.page_id,
  p.workspace_id,
  'email' as channel_type,
  LOWER(ps.email) as email,
  NULL as webhook_url,
  -- Preserve existing token, or generate new UUID only if NULL
  COALESCE(
    ps.token,
    lower(hex(randomblob(4))) || '-' ||
    lower(hex(randomblob(2))) || '-' ||
    '4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
    substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
    lower(hex(randomblob(6)))
  ) as token,
  ps.accepted_at as verified_at,
  ps.expires_at,
  ps.unsubscribed_at,
  COALESCE(ps.created_at, strftime('%s', 'now')) as created_at,
  strftime('%s', 'now') as updated_at
FROM page_subscriber ps
INNER JOIN page p ON ps.page_id = p.id
WHERE ps.email IS NOT NULL
  -- Skip if already exists (by email + page_id + channel_type)
  AND NOT EXISTS (
    SELECT 1 FROM page_subscription psub
    WHERE LOWER(psub.email) = LOWER(ps.email)
      AND psub.page_id = ps.page_id
      AND psub.channel_type = 'email'
  )
ORDER BY ps.id ASC;
