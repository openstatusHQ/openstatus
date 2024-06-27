"use client";

import { columns } from "./_components/columns";
import { tagsColor } from "./_components/constants";
import { DataTable } from "./_components/data-table";
import { type Schema, schema } from "./_components/schema";
import type { DataTableFilterField, Option } from "./_components/types";

// TODO: add schema validation

export default function TestPage({
  searchParams,
}: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const search = schema.safeParse(searchParams);

  if (!search.success) {
    console.log(search.error);
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="m-4 rounded-lg border bg-background p-6">
        <DataTable
          columns={columns}
          data={data}
          filterFields={filterFields}
          defaultColumnFilters={Object.entries(search.data).map(
            ([key, value]) => ({ id: key, value }),
          )}
        />
      </div>
    </div>
  );
}

const data = [
  {
    name: "Edge Api",
    public: true,
    active: true,
    regions: ["ams", "gru", "syd"],
    tags: ["api", "enterprise"],
  },
  {
    name: "Lambda Api",
    public: true,
    active: true,
    regions: ["ams", "gru", "syd"],
    tags: ["api"],
  },
  {
    name: "OpenStatus",
    public: false,
    active: false,
    regions: ["iad", "fra"],
    tags: ["enterprise"],
  },
  {
    name: "Storybook",
    public: false,
    active: true,
    regions: ["iad"],
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
    tags: ["app"],
  },
  {
    name: "Demo",
    public: true,
    active: true,
    regions: ["iad"],
    tags: ["web"],
  },
  {
    name: "Documentation",
    public: true,
    active: true,
    regions: ["ams"],
    tags: ["api", "web"],
  },
  {
    name: "Boilerplate",
    public: true,
    active: false,
    regions: ["gru", "fra"],
    tags: ["web"],
  },
  {
    name: "Dashboard",
    public: false,
    active: true,
    regions: ["iad", "fra"],
    tags: ["web"],
  },
  {
    name: "E2E Testing",
    public: false,
    active: true,
    regions: ["iad"],
    tags: ["web"],
  },
  {
    name: "Web App",
    public: true,
    active: true,
    regions: ["iad"],
    tags: ["web"],
  },
] satisfies Schema[];

const filterFields = [
  {
    label: "Public",
    value: "public",
    options: [
      { label: "true", value: true },
      { label: "false", value: false },
    ],
  },
  {
    label: "Active",
    value: "active",
    options: [
      { label: "true", value: true },
      { label: "false", value: false },
    ],
  },
  {
    label: "Regions",
    value: "regions",
    options: [
      { label: "ams", value: "ams" },
      { label: "fra", value: "fra" },
      { label: "hkg", value: "hkg" },
      { label: "iad", value: "iad" },
      { label: "gru", value: "gru" },
      { label: "syd", value: "syd" },
    ],
  },
  {
    label: "Tags",
    value: "tags",
    // REMINDER: "use client" needs to be declared in the file - otherwise getting serialization error from Server Component
    component: (props: Option) => {
      if (typeof props.value === "boolean") return null;
      return (
        <div className="flex w-full items-center justify-between gap-2">
          <span className="truncate font-normal">{props.value}</span>
          <span
            className={"h-2 w-2 rounded-full"}
            style={{ backgroundColor: tagsColor[props.value] }}
          />
        </div>
      );
    },
    options: [
      // should we include some more descriptions (like the full name "Amsterdam") maybe with text-popover-muted
      { label: "web", value: "web" },
      { label: "api", value: "api" },
      { label: "enterprise", value: "enterprise" },
      { label: "app", value: "app" },
    ],
  },
] satisfies DataTableFilterField<Schema>[];
