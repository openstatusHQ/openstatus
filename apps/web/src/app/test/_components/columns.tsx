"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { Event } from "./search";

export const columns: ColumnDef<Event>[] = [
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
      if (Array.isArray(value)) return value.every((i) => array.includes(i));
      return false;
    },
  },
  {
    accessorKey: "active",
    header: "Active",
  },
  {
    accessorKey: "public",
    header: "Public",
    filterFn: (row, id, value) => {
      const stringify = String(row.getValue(id));
      if (typeof value === "string") return value === stringify;
      if (Array.isArray(value)) return value.includes(stringify);
      return false;
    },
  },
];
