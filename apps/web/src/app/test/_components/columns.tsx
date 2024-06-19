"use client";

import type { ColumnDef } from "@tanstack/react-table";
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
      const value = row.getValue("tags");
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
    accessorKey: "active",
    header: "Active",
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
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id);
      if (typeof value === "string") return value === String(rowValue);
      if (Array.isArray(value)) return value.includes(rowValue);
      return false;
    },
  },
];
