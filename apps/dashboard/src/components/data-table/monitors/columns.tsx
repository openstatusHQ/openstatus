"use client";

import { TableCellLink } from "@/components/data-table/table-cell-link";
// import { TableCellNumber } from "@/components/data-table/table-cell-number";
// import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
// import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTableRowActions } from "./data-table-row-actions";

import type { RouterOutputs } from "@openstatus/api";

type Monitor = RouterOutputs["monitor"]["list"][number];

export const columns: ColumnDef<Monitor>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => {
      return (
        <TableCellLink
          value={row.getValue("name")}
          href={`/monitors/${row.original.id}/overview`}
        />
      );
    },
    enableSorting: false,
    enableHiding: false,
    meta: {
      cellClassName: "max-w-[150px] min-w-max",
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const value = String(row.getValue("status"));
      switch (value) {
        case "Normal":
          return <div className="font-mono text-success">{value}</div>;
        case "Degraded":
          return <div className="font-mono text-warning">{value}</div>;
        case "Failing":
          return <div className="font-mono text-destructive">{value}</div>;
        default:
          return <div className="font-mono text-muted-foreground">{value}</div>;
      }
    },
    enableSorting: false,
    enableHiding: false,
  },
  // {
  //   accessorKey: "tags",
  //   header: "Tags",
  //   cell: ({ row }) => {
  //     const value = row.getValue("tags");
  //     if (!Array.isArray(value)) return null;
  //     return (
  //       <div className="flex gap-2">
  //         {value.map((tag) => (
  //           <Badge key={tag} variant="secondary">
  //             {tag}
  //           </Badge>
  //         ))}
  //       </div>
  //     );
  //   },
  //   enableSorting: false,
  //   enableHiding: false,
  // },
  // {
  //   accessorKey: "lastIncident",
  //   header: ({ column }) => (
  //     <DataTableColumnHeader column={column} title="Last Incident" />
  //   ),
  //   cell: ({ row }) => {
  //     const value = String(row.getValue("lastIncident") ?? "-");
  //     return <div className="text-muted-foreground">{value}</div>;
  //   },
  //   enableHiding: false,
  // },
  // {
  //   accessorKey: "p50",
  //   header: ({ column }) => (
  //     <DataTableColumnHeader column={column} title="P50" />
  //   ),
  //   cell: ({ row }) => (
  //     <TableCellNumber value={row.getValue("p50")} unit="ms" />
  //   ),
  //   enableHiding: false,
  // },
  // {
  //   accessorKey: "p90",
  //   header: ({ column }) => (
  //     <DataTableColumnHeader column={column} title="P90" />
  //   ),
  //   cell: ({ row }) => (
  //     <TableCellNumber value={row.getValue("p90")} unit="ms" />
  //   ),
  //   enableHiding: false,
  // },
  // {
  //   accessorKey: "p99",
  //   header: ({ column }) => (
  //     <DataTableColumnHeader column={column} title="P99" />
  //   ),
  //   cell: ({ row }) => (
  //     <TableCellNumber value={row.getValue("p99")} unit="ms" />
  //   ),
  //   enableHiding: false,
  // },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
    meta: {
      cellClassName: "w-8",
    },
  },
];
