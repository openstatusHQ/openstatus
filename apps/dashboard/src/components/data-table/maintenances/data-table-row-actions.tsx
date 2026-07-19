"use client";

import type { RouterOutputs } from "@openstatus/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";
import { useRef } from "react";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { FormSheetMaintenance } from "@/components/forms/maintenance/sheet";
import { toCheckboxTreeItems } from "@/components/ui/checkbox-tree";
import { getActions } from "@/data/maintenances.client";
import { useTRPC } from "@/lib/trpc/client";

type Maintenance = RouterOutputs["maintenance"]["list"][number];

export function DataTableRowActions({ row }: { row: Row<Maintenance> }) {
  return <MaintenanceRowActions maintenance={row.original} />;
}

export function MaintenanceRowActions({
  maintenance,
}: {
  maintenance: Maintenance;
}) {
  const trpc = useTRPC();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const actions = getActions({
    edit: () => buttonRef.current?.click(),
  });
  const { data: statusPage } = useQuery(
    trpc.page.get.queryOptions({ id: maintenance.pageId ?? 0 }),
  );
  const queryClient = useQueryClient();
  // no-input prefix key — matches every maintenance.list query (overview, page detail)
  const invalidateList = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.maintenance.list.queryKey(),
    });
  const updateMaintenanceMutation = useMutation(
    trpc.maintenance.update.mutationOptions({
      onSuccess: invalidateList,
    }),
  );

  const deleteMaintenanceMutation = useMutation(
    trpc.maintenance.delete.mutationOptions({
      onSuccess: invalidateList,
    }),
  );

  return (
    <>
      <QuickActions
        actions={actions}
        deleteAction={{
          confirmationValue: maintenance.title ?? "maintenance",
          submitAction: async () => {
            await deleteMaintenanceMutation.mutateAsync({
              id: maintenance.id,
            });
          },
        }}
      />
      <FormSheetMaintenance
        items={toCheckboxTreeItems(
          statusPage?.pageComponents ?? [],
          statusPage?.pageComponentGroups ?? [],
        )}
        defaultValues={{
          title: maintenance.title,
          message: maintenance.message,
          startDate: maintenance.from,
          endDate: maintenance.to,
          pageComponents: maintenance.pageComponents?.map((c) => c.id) ?? [],
        }}
        onSubmit={async (values) => {
          await updateMaintenanceMutation.mutateAsync({
            id: maintenance.id,
            title: values.title,
            message: values.message,
            startDate: values.startDate,
            endDate: values.endDate,
            pageComponents: values.pageComponents,
          });
        }}
      >
        <button ref={buttonRef} type="button" className="sr-only">
          Open sheet
        </button>
      </FormSheetMaintenance>
    </>
  );
}
