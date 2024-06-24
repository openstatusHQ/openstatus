import { columns } from "./_components/columns";
import { tagsColor } from "./_components/constants";
import { DataTable } from "./_components/data-table";
import type { DataTableFilterField, Option } from "./_components/types";
import { schema, type Schema } from "./_components/schema";

// TODO: add schema validation

export default function TestPage({
  searchParams,
}: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const search = schema.safeParse(searchParams);

  console.log(searchParams);

  if (!search.success) {
    console.log(search.error);
    return null;
  }

  return (
    <div className="mx-auto my-4 w-full max-w-5xl rounded-lg border bg-background p-6">
      <DataTable
        columns={columns}
        data={data}
        filterFields={filterFields}
        defaultColumnFilters={Object.entries(search.data).map(
          ([key, value]) => ({ id: key, value }),
        )}
      />
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
    name: "Documentation",
    public: true,
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
    public: true,
    active: true,
    regions: ["iad"],
    tags: ["web"],
  },
  {
    name: "Dashboard",
    public: false,
    active: true,
    regions: ["iad", "fra"],
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
    // REMINDER: Error: Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with "use server".
    // Or maybe you meant to call this function rather than return it.
    // FIXME:
    // component: async (props: Option) => {
    //   "use server";
    //   if (typeof props.value === "boolean") return null;
    //   return (
    //     <div className="flex w-full items-center justify-between gap-2">
    //       <span className="truncate font-normal">{props.value}</span>
    //       <span
    //         className={"h-2 w-2 rounded-full"}
    //         style={{ backgroundColor: tagsColor[props.value] }}
    //       />
    //     </div>
    //   );
    // },
    options: [
      // should we include some more descriptions (like the full name "Amsterdam") maybe with text-popover-muted
      { label: "web", value: "web" },
      { label: "api", value: "api" },
      { label: "enterprise", value: "enterprise" },
    ],
  },
  // FIXME: can we use the columns instead? Schema works for sure
] satisfies DataTableFilterField<Schema>[];
