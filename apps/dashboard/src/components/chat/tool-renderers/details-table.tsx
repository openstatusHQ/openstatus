import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@openstatus/ui/components/ui/table";
import { Fragment, type ReactNode } from "react";

/**
 * Two-column key/value view for chat `get_*` tool results — the
 * descriptive single-record counterpart to `ResultTable` (lists) and
 * `ChangesTable` (diffs). Per-tool descriptors map output to rows whose
 * value side is rendered with `TableCell*` primitives so timestamps,
 * numbers, and booleans get type-aware formatting. Sections render a
 * colspan-2 title row above their rows (mirrors the response-logs sheet).
 */
export type DetailsRow = {
  label: string;
  value: ReactNode;
};

export type DetailsSection = {
  title?: string;
  rows: DetailsRow[];
};

export type DetailsTableData = {
  sections: DetailsSection[];
  empty?: string;
};

export function DetailsTable({ sections, empty }: DetailsTableData) {
  const total = sections.reduce((acc, s) => acc + s.rows.length, 0);
  if (total === 0) {
    return (
      <div className="rounded-md border bg-background p-3 text-muted-foreground text-sm">
        {empty ?? "No details to show."}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <Table>
        <TableBody>
          {sections.map((section, sIdx) => (
            <Fragment key={section.title ?? sIdx}>
              {section.title ? (
                <TableRow className="hover:bg-transparent">
                  <TableHead colSpan={2}>{section.title}</TableHead>
                </TableRow>
              ) : null}
              {section.rows.map((row) => (
                <TableRow
                  key={`${sIdx}-${row.label}`}
                  className="hover:bg-transparent"
                >
                  <TableHead className="w-1/3 border-r bg-muted/40 font-mono text-muted-foreground">
                    {row.label}
                  </TableHead>
                  <TableCell className="whitespace-normal break-words font-mono">
                    {row.value}
                  </TableCell>
                </TableRow>
              ))}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
