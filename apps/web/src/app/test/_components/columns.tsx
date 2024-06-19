"use client";

import { TagBadge } from "@/components/monitor/tag-badge";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, Minus } from "lucide-react";
import { tagsColor } from "./constants";
import type { Schema } from "./utils";

export const columns: ColumnDef<Schema>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "regions",
    header: "Regions",
    cell: ({ row }) => {
      const value = row.getValue("regions");
      if (Array.isArray(value)) {
        return <div>{value.join(", ")}</div>;
      }
      return <div>{`${value}`}</div>;
    },
    filterFn: (row, id, value) => {
      const array = row.getValue(id) as string[];
      if (typeof value === "string") return array.includes(value);
      // up to the user to define either `.some` or `.every`
      if (Array.isArray(value)) return value.some((i) => array.includes(i));
      return false;
    },
  },
  {
    accessorKey: "tags",
    header: "Tags",
    cell: ({ row }) => {
      const value = row.getValue("tags") as string | string[];
      if (Array.isArray(value)) {
        return (
          <div className="flex flex-wrap gap-1">
            {value.map((v) => (
              <TagBadge key={v} name={v} color={tagsColor[v]} />
            ))}
          </div>
        );
      }
      return <TagBadge name={value} color={tagsColor[value]} />;
    },
    filterFn: (row, id, value) => {
      const array = row.getValue(id) as string[];
      if (typeof value === "string") return array.includes(value);
      // up to the user to define either `.some` or `.every`
      if (Array.isArray(value)) return value.some((i) => array.includes(i));
      return false;
    },
  },
  {
    accessorKey: "active",
    header: "Active",
    cell: ({ row }) => {
      const value = row.getValue("active");
      if (value) return <Check className="h-4 w-4" />;
      return <Minus className="h-4 w-4 text-muted-foreground/50" />;
    },
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id);
      if (typeof value === "string") return value === String(rowValue);
      if (Array.isArray(value)) return value.includes(rowValue);
      return false;
    },
  },
  {
    accessorKey: "public",
    header: "Public",
    cell: ({ row }) => {
      const value = row.getValue("public");
      if (value) return <Check className="h-4 w-4" />;
      return <Minus className="h-4 w-4 text-muted-foreground/50" />;
    },
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id);
      if (typeof value === "string") return value === String(rowValue);
      if (Array.isArray(value)) return value.includes(rowValue);
      return false;
    },
  },
];
