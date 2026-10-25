"use client";

import type { RouterOutputs } from "@openstatus/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";
import { useState } from "react";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { MaintenanceEditSheet } from "@/components/maintenances/maintenance-edit-sheet";
import { getActions } from "@/data/maintenances.client";
import { useTRPC } from "@/lib/trpc/client";

type Maintenance = RouterOutputs["maintenance"]["list"][number];

export function DataTableRowActions({ row }: { row: Row<Maintenance> }) {
  return <MaintenanceRowActions maintenance={row.original} />;
}

/** Row menu; owns the edit sheet unless the row passes `onEdit` to open its own. */
export function MaintenanceRowActions({
  maintenance,
  onEdit,
}: {
  maintenance: Maintenance;
  onEdit?: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const actions = getActions({
    edit: onEdit ?? (() => setEditOpen(true)),
  });
  const deleteMaintenanceMutation = useMutation(
    trpc.maintenance.delete.mutationOptions({
      // no-input prefix key — matches every maintenance.list query (overview, page detail)
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.maintenance.list.queryKey(),
        }),
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
      {onEdit ? null : (
        <MaintenanceEditSheet
          maintenance={maintenance}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </>
  );
}
