"use client";

import { DataTable } from "./_components/data-table";
import { columns } from "./_components/columns";
import type { Schema } from "./_components/utils";

export default async function TestPage() {
  return (
    <div className="mx-auto my-4 w-full max-w-5xl rounded-lg border bg-background p-6">
      <DataTable columns={columns} data={data} />
    </div>
  );
}

const data = [
  {
    name: "Test",
    public: true,
    active: false,
    regions: ["ams", "gru", "syd"],
  },
  {
    name: "Test 2",
    public: false,
    active: true,
    regions: ["ams", "syd"],
  },
  {
    name: "Test 3",
    public: true,
    active: false,
    regions: ["ams", "gru"],
  },
  {
    name: "Test 4",
    public: true,
    active: true,
    regions: ["syd"],
  },
  {
    name: "Test 5",
    public: false,
    active: true,
    regions: ["gru"],
  },
  {
    name: "Test 6",
    public: false,
    active: true,
    regions: ["ams", "syd"],
  },
  {
    name: "Test 7",
    public: true,
    active: false,
    regions: ["ams"],
  },
  {
    name: "Test 8",
    public: false,
    active: false,
    regions: ["syd"],
  },
  {
    name: "Test 9",
    public: true,
    active: false,
    regions: ["fra", "gru"],
  },
  {
    name: "Test 10",
    public: false,
    active: false,
    regions: ["fra"],
  },
  {
    name: "Test 11",
    public: true,
    active: false,
    regions: ["hkg", "gru"],
  },
  {
    name: "Test 12",
    public: false,
    active: false,
    regions: ["hkg"],
  },
  {
    name: "Test 13",
    public: true,
    active: true,
    regions: ["iad", "fra"],
  },
] satisfies Schema[];
