DROP INDEX IF EXISTS page_custom_domain_unique;--> statement-breakpoint
/*
 SQLite does not support "Drop default from column" out of the box, we do not generate automatic migration for that, so it has to be done manually
 Please refer to: https://www.techonthenet.com/sqlite/tables/alter_table.php
                  https://www.sqlite.org/lang_altertable.html
                  https://stackoverflow.com/questions/2083543/modify-a-columns-type-in-sqlite3

 Due to that we don't generate migration automatically and it has to be done manually
*/

ALTER TABLE `page` RENAME TO `page_old`;
--> statement-breakpoint

CREATE TABLE `page` (
    id integer PRIMARY KEY NOT NULL,
    workspace_id integer NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    icon text(256),
    slug text(256) NOT NULL,
    custom_domain text(256),
    updated_at integer DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (workspace_id) REFERENCES workspace(id) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO page SELECT * FROM `page_old`;

--> statement-breakpoint
DROP TABLE `page_old`;

