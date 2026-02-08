"use client";

import { Link } from "@/components/common/link";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionHeaderRow,
  SectionTitle,
} from "@/components/content/section";
import { columns } from "@/components/data-table/maintenances/columns";
import { FormSheetMaintenance } from "@/components/forms/maintenance/sheet";
import { DataTable } from "@/components/ui/data-table/data-table";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useParams } from "next/navigation";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: statusPage } = useQuery(
    trpc.page.get.queryOptions({ id: Number.parseInt(id) }),
  );
  const { data: maintenances, refetch } = useQuery(
    trpc.maintenance.list.queryOptions({
      pageId: Number.parseInt(id),
    }),
  );
  const sendMaintenanceUpdateMutation = useMutation(
    trpc.emailRouter.sendMaintenance.mutationOptions(),
  );
  const createMaintenanceMutation = useMutation(
    trpc.maintenance.new.mutationOptions({
      onSuccess: (maintenance) => {
        // TODO: move to server
        if (maintenance.notifySubscribers) {
          sendMaintenanceUpdateMutation.mutateAsync({ id: maintenance.id });
        }
        //
        refetch();
      },
    }),
  );

  if (!statusPage || !maintenances) return null;

  return (
    <SectionGroup>
      <Section>
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>{statusPage.title}</SectionTitle>
            <SectionDescription>
              List of all maintenances. Looking for{" "}
              <Link href={`/status-pages/${id}/status-reports`}>
                status reports
              </Link>
              ?
            </SectionDescription>
          </SectionHeader>
          <div>
            <FormSheetMaintenance
              pageComponents={statusPage.pageComponents}
              onSubmit={async (values) => {
                await createMaintenanceMutation.mutateAsync({
                  pageId: Number.parseInt(id),
                  title: values.title,
                  message: values.message,
                  startDate: values.startDate,
                  endDate: values.endDate,
                  pageComponents: values.pageComponents,
                  notifySubscribers: values.notifySubscribers,
                });
              }}
            >
              <Button data-section="action" size="sm">
                <Plus />
                Create Maintenance
              </Button>
            </FormSheetMaintenance>
          </div>
        </SectionHeaderRow>
        <DataTable columns={columns} data={maintenances} />
      </Section>
    </SectionGroup>
  );
}
