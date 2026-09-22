CREATE TABLE `notification_dead_letter` (
	`id` integer PRIMARY KEY NOT NULL,
	`outbox_id` integer NOT NULL,
	`dedup_key` text NOT NULL,
	`monitor_id` integer NOT NULL,
	`workspace_id` integer,
	`notification_id` integer NOT NULL,
	`provider` text NOT NULL,
	`event_type` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`cron_timestamp` integer NOT NULL,
	`incident_id` integer,
	`payload` text NOT NULL,
	`attempts` integer NOT NULL,
	`final_error` text,
	`died_at` integer NOT NULL,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_dead_letter_dedup_key_idx` ON `notification_dead_letter` (`dedup_key`);--> statement-breakpoint
CREATE INDEX `notification_dead_letter_workspace_id_died_at_idx` ON `notification_dead_letter` (`workspace_id`,`died_at`);--> statement-breakpoint
CREATE TABLE `notification_outbox` (
	`id` integer PRIMARY KEY NOT NULL,
	`dedup_key` text NOT NULL,
	`monitor_id` integer NOT NULL,
	`workspace_id` integer,
	`notification_id` integer NOT NULL,
	`provider` text NOT NULL,
	`event_type` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`cron_timestamp` integer NOT NULL,
	`incident_id` integer,
	`payload` text NOT NULL,
	`delivery_status` text DEFAULT 'pending' NOT NULL,
	`outcome` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`deadline_at` integer NOT NULL,
	`locked_by` text,
	`locked_until` integer,
	`delivered_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`notification_id`) REFERENCES `notification`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`incident_id`) REFERENCES `incident`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_outbox_dedup_key_idx` ON `notification_outbox` (`dedup_key`);--> statement-breakpoint
CREATE INDEX `notification_outbox_claim_idx` ON `notification_outbox` (`next_attempt_at`) WHERE "notification_outbox"."delivery_status" = 'pending';--> statement-breakpoint
CREATE INDEX `notification_outbox_notification_id_cron_timestamp_idx` ON `notification_outbox` (`notification_id`,`cron_timestamp`);--> statement-breakpoint
CREATE INDEX `notification_outbox_channel_idx` ON `notification_outbox` (`monitor_id`,`notification_id`) WHERE "notification_outbox"."delivery_status" = 'pending';--> statement-breakpoint
CREATE TABLE `monitor_transition` (
	`id` integer PRIMARY KEY NOT NULL,
	`monitor_id` integer NOT NULL,
	`region` text NOT NULL,
	`cron_timestamp` integer NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`quorum_count` integer NOT NULL,
	`region_count` integer NOT NULL,
	`transitioned` integer NOT NULL,
	`outbox_rows` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `monitor_transition_monitor_id_cron_timestamp_idx` ON `monitor_transition` (`monitor_id`,`cron_timestamp`);--> statement-breakpoint
CREATE INDEX `monitor_transition_created_at_idx` ON `monitor_transition` (`created_at`);--> statement-breakpoint
-- The check-then-act race in createIncident left monitors with several open
-- incidents, which the partial unique index below would reject. Keep the newest
-- open incident per monitor and resolve the ones it superseded, at the keeper's
-- start (never before their own). The keeper set is an uncorrelated subquery, so
-- it is materialised once and does not shift as rows are resolved.
UPDATE `incident`
SET `resolved_at` = max(
      `started_at`,
      coalesce(
        (SELECT k.`started_at`
           FROM `incident` k
          WHERE k.`monitor_id` = `incident`.`monitor_id`
            AND k.`id` IN (SELECT max(x.`id`) FROM `incident` x
                            WHERE x.`resolved_at` IS NULL
                              AND x.`monitor_id` IS NOT NULL
                            GROUP BY x.`monitor_id`)),
        `started_at`)),
    `auto_resolved` = 1
WHERE `resolved_at` IS NULL
  AND `monitor_id` IS NOT NULL
  AND `id` NOT IN (SELECT max(x.`id`) FROM `incident` x
                    WHERE x.`resolved_at` IS NULL
                      AND x.`monitor_id` IS NOT NULL
                    GROUP BY x.`monitor_id`);--> statement-breakpoint
DROP INDEX `incident_open_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `incident_open_idx` ON `incident` (`monitor_id`) WHERE "incident"."resolved_at" IS NULL;--> statement-breakpoint
ALTER TABLE `monitor_status` ADD `cron_timestamp` integer DEFAULT 0 NOT NULL;