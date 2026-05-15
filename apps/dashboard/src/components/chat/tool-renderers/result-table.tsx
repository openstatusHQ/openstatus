import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui/components/ui/table";
import type { ReactNode } from "react";

/**
 * Tabular result view used by `list_*` chat tool renderers — the read-side
 * counterpart to `ChangesTable`. Each tool ships a descriptor (e.g.
 * `listStatusPagesTable`) that maps the tool's output to columns + rows;
 * the registry consumes it via `<ResultTable {...descriptor(output)} />`.
 *
 * `cellClassName` on a column applies to every cell in that column — keep
 * per-row formatting (mono, badges) in the column definition rather than in
 * each row's cell.
 */
export type ResultColumn<K extends string = string> = {
  key: K;
  header: string;
  cellClassName?: string;
};

export type ResultRow<K extends string = string> = {
  id: string | number;
  cells: Record<K, ReactNode>;
};

export type ResultTableData<K extends string = string> = {
  columns: ResultColumn<K>[];
  rows: ResultRow<K>[];
  empty: string;
};

export function ResultTable<K extends string>({
  columns,
  rows,
  empty,
}: ResultTableData<K>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border bg-background p-3 text-muted-foreground text-sm">
        {empty}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className="font-mono text-muted-foreground"
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              {columns.map((col) => (
                <TableCell key={col.key} className={col.cellClassName}>
                  {row.cells[col.key]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
