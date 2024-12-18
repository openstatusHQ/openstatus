import { EmptyState } from "@/components/dashboard/empty-state";
import { columns } from "@/components/data-table/maintenance/columns";
import { DataTable } from "@/components/data-table/maintenance/data-table";
import { api } from "@/trpc/server";
import { Button } from "@openstatus/ui/src/components/button";
import Link from "next/link";

export default async function MaintenancePage(props: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const params = await props.params;
  const maintenances = await api.maintenance.getByPage.query({
    id: Number(params.id),
  });

  if (maintenances?.length === 0)
    return (
      <EmptyState
        icon="hammer"
        title="No maintenances"
        description="Add a maintenance to your status page."
        action={
          <Button asChild>
            <Link href="./maintenances/new">Create a maintenance</Link>
          </Button>
        }
      />
    );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button size="sm" asChild>
          <Link href="./maintenances/new">Create a maintenance</Link>
        </Button>
      </div>
      <DataTable data={maintenances} columns={columns} />
    </div>
  );
}
