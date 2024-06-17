"use client";

import { DataTable } from "./_components/data-table";
import { columns } from "./_components/columns";
import type { Schema } from "./_components/utils";

export default async function TestPage() {
  return (
    <div className="mx-auto my-16 w-full max-w-5xl rounded-lg border bg-background p-6">
      <DataTable columns={columns} data={data} />
    </div>
  );
}

const data = [
  {
    name: "Edge Api",
    public: true,
    active: true,
    regions: ["ams", "gru", "syd"],
    tags: ["api"],
  },
  {
    name: "Lambda Api",
    public: true,
    active: true,
    regions: ["ams", "gru", "syd"],
    tags: ["api"],
  },
  {
    name: "Documentation",
    public: false,
    active: true,
    regions: ["ams"],
    tags: ["web"],
  },
  {
    name: "Marketing Site",
    public: true,
    active: true,
    regions: ["hkg", "fra", "iad"],
    tags: ["web"],
  },
  {
    name: "App",
    public: false,
    active: true,
    regions: ["iad", "fra"],
    tags: ["web"],
  },
  {
    name: "Demo",
    public: false,
    active: false,
    regions: ["iad"],
    tags: ["web"],
  },
] satisfies Schema[];
