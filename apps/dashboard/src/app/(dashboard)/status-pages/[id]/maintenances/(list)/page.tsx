"use client";

import { Maintenance } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import NextLink from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Link } from "@/components/common/link";
import {
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateMedia,
  EmptyStateTitle,
} from "@/components/content/empty-state";
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
import { toCheckboxTreeItems } from "@/components/ui/checkbox-tree";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableEmpty } from "@/components/ui/data-table/data-table-empty";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
import { useTRPC } from "@/lib/trpc/client";
import { errorMessage } from "@/lib/trpc/error";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [openCreate, setOpenCreate] = useState(false);
  const { data: statusPage } = useQuery(
    trpc.page.get.queryOptions({ id: Number.parseInt(id) }),
  );
  const { data: maintenances, refetch } = useQuery(
    trpc.maintenance.list.queryOptions({
      pageId: Number.parseInt(id),
    }),
  );
  const sendMaintenanceUpdateMutation = useMutation(
    trpc.subscriberNotification.maintenance.mutationOptions({
      onError: (error) => {
        toast.error(errorMessage(error, "Failed to notify subscribers"));
      },
    }),
  );
  const createMaintenanceMutation = useMutation(
    trpc.maintenance.new.mutationOptions({
      onSuccess: (maintenance) => {
        refetch();
        queryClient.invalidateQueries({
          queryKey: trpc.page.list.queryKey(),
        });
        if (maintenance.notifySubscribers) {
          sendMaintenanceUpdateMutation.mutate({
            id: maintenance.initialUpdateId,
          });
        }
      },
    }),
  );

  if (!statusPage || !maintenances) return null;

  const items = toCheckboxTreeItems(
    statusPage.pageComponents,
    statusPage.pageComponentGroups,
  );
  const createMaintenance = async (
    values: Parameters<
      React.ComponentProps<typeof FormSheetMaintenance>["onSubmit"]
    >[0],
  ) => {
    await createMaintenanceMutation.mutateAsync({
      pageId: Number.parseInt(id),
      title: values.title,
      message: values.message ?? "",
      startDate: values.startDate,
      endDate: values.endDate,
      pageComponents: values.pageComponents,
      notifySubscribers: values.notifySubscribers,
    });
  };

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
              open={openCreate}
              onOpenChange={setOpenCreate}
              items={items}
              onSubmit={createMaintenance}
            >
              <Button data-section="action" size="sm">
                Create Maintenance
              </Button>
            </FormSheetMaintenance>
          </div>
        </SectionHeaderRow>
        <DataTable
          paginationComponent={DataTablePaginationSimple}
          columns={columns}
          data={maintenances}
          emptyState={
            <DataTableEmpty>
              <EmptyStateMedia>
                <Maintenance />
              </EmptyStateMedia>
              <EmptyStateTitle>No maintenance scheduled</EmptyStateTitle>
              <EmptyStateDescription>
                Announce planned downtime ahead of time. During the window the
                affected components show as under maintenance instead of
                triggering alerts.
              </EmptyStateDescription>
              <EmptyStateActions>
                <Button size="sm" onClick={() => setOpenCreate(true)}>
                  Schedule maintenance
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <NextLink href={`/status-pages/${id}/status-reports`}>
                    View status reports
                  </NextLink>
                </Button>
              </EmptyStateActions>
            </DataTableEmpty>
          }
        />
      </Section>
    </SectionGroup>
  );
}
