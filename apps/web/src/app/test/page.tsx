import { columns } from "./_components/columns";
import { DataTable } from "./_components/data-table";
import { schema, type Schema } from "./_components/utils";

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
