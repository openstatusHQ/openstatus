/*
 SQLite does not support "Set autoincrement to a column" out of the box, we do not generate automatic migration for that, so it has to be done manually
 Please refer to: https://www.techonthenet.com/sqlite/tables/alter_table.php
                  https://www.sqlite.org/lang_altertable.html
                  https://stackoverflow.com/questions/2083543/modify-a-columns-type-in-sqlite3

 Due to that we don't generate migration automatically and it has to be done manually
*/
ALTER TABLE monitor ALTER COLUMN id  TO id INTEGER PRIMARY KEY AUTOINCREMENT; --> statement-breakpoint
ALTER TABLE integration ALTER COLUMN id  TO id INTEGER PRIMARY KEY AUTOINCREMENT; --> statement-breakpoint
ALTER TABLE invitation ALTER COLUMN id  TO id INTEGER PRIMARY KEY AUTOINCREMENT; --> statement-breakpoint
ALTER TABLE notification ALTER COLUMN id  TO id INTEGER PRIMARY KEY AUTOINCREMENT; --> statement-breakpoint
ALTER TABLE page_subscriber ALTER COLUMN id  TO id INTEGER PRIMARY KEY AUTOINCREMENT; --> statement-breakpoint
ALTER TABLE status_report ALTER COLUMN id  TO id INTEGER PRIMARY KEY AUTOINCREMENT; --> statement-breakpoint
ALTER TABLE status_report_update ALTER COLUMN id  TO id INTEGER PRIMARY KEY AUTOINCREMENT;
