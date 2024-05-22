import type { Column } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type {
  SQLiteTable,
  SQLiteUpdateSetSource,
} from "drizzle-orm/sqlite-core";

export function conflictUpdateSet<TTable extends SQLiteTable>(
  table: TTable,
  columns: (keyof TTable["_"]["columns"] & keyof TTable)[],
): SQLiteUpdateSetSource<TTable> {
  return Object.assign(
    {},
    ...columns.map((k) => ({
      [k]: sql`excluded.${(table[k] as Column).name}`,
    })),
  ) as SQLiteUpdateSetSource<TTable>;
}
