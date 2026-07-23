import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@openstatus/ui/components/ui/table";
import { Fragment, type ReactNode } from "react";

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
      <div className="bg-background text-muted-foreground rounded-md border p-3 text-sm">
        {empty ?? "No details to show."}
      </div>
    );
  }
  return (
    <div className="bg-background overflow-hidden rounded-md border">
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
                  <TableHead className="bg-muted/40 text-muted-foreground w-1/3 border-r font-mono">
                    {row.label}
                  </TableHead>
                  <TableCell className="font-mono break-words whitespace-normal">
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
