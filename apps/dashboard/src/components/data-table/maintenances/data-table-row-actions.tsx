"use client";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { FormSheetMaintenance } from "@/components/forms/maintenance/sheet";
import { getActions } from "@/data/maintenances.client";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@openstatus/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";
import { useRef } from "react";

type Maintenance = RouterOutputs["maintenance"]["list"][number];

interface DataTableRowActionsProps {
  row: Row<Maintenance>;
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const trpc = useTRPC();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const actions = getActions({
    edit: () => buttonRef.current?.click(),
  });
  const { data: statusPage } = useQuery(
    trpc.page.get.queryOptions({ id: row.original.pageId ?? 0 }),
  );
  const queryClient = useQueryClient();
  const updateMaintenanceMutation = useMutation(
    trpc.maintenance.update.mutationOptions({
      onSuccess: () => {
        queryClient.refetchQueries({
          queryKey: trpc.maintenance.list.queryKey({
            pageId: row.original.pageId ?? undefined,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.maintenance.list.queryKey({
            period: "7d",
          }),
        });
      },
    }),
  );

  const deleteMaintenanceMutation = useMutation(
    trpc.maintenance.delete.mutationOptions({
      onSuccess: () => {
        queryClient.refetchQueries({
          queryKey: trpc.maintenance.list.queryKey({
            pageId: row.original.pageId ?? undefined,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.maintenance.list.queryKey({
            period: "7d",
          }),
        });
      },
    }),
  );

  return (
    <>
      <QuickActions
        actions={actions}
        deleteAction={{
          confirmationValue: row.original.title ?? "maintenance",
          submitAction: async () => {
            await deleteMaintenanceMutation.mutateAsync({
              id: row.original.id,
            });
          },
        }}
      />
      <FormSheetMaintenance
        pageComponents={statusPage?.pageComponents ?? []}
        defaultValues={{
          title: row.original.title,
          message: row.original.message,
          startDate: row.original.from,
          endDate: row.original.to,
          pageComponents: row.original.pageComponents?.map((c) => c.id) ?? [],
        }}
        onSubmit={async (values) => {
          await updateMaintenanceMutation.mutateAsync({
            id: row.original.id,
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
