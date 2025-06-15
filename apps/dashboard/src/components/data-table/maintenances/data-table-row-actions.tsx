"use client";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { FormSheetMaintenance } from "@/components/forms/maintenance/sheet";
import { getActions } from "@/data/maintenances.client";
import { useTRPC } from "@/lib/trpc/client";
import { RouterOutputs } from "@openstatus/api";
import { useMutation } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";
import { useRef } from "react";

type Maintenance = RouterOutputs["maintenance"]["list"][number];

interface DataTableRowActionsProps {
  row: Row<Maintenance>;
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const actions = getActions({
    edit: () => buttonRef.current?.click(),
  });
  const trpc = useTRPC();
  const updateMaintenanceMutation = useMutation(
    trpc.maintenance.update.mutationOptions({})
  );

  return (
    <>
      <QuickActions
        actions={actions}
        deleteAction={{
          title: "Delete",
          confirmationValue: "delete",
        }}
      />
      <FormSheetMaintenance
        monitors={[]}
        defaultValues={{
          title: row.original.title,
          message: row.original.message,
          startDate: row.original.from,
          endDate: row.original.to,
          monitors: row.original.monitors ?? [],
        }}
        onSubmit={async (values) => {
          await updateMaintenanceMutation.mutateAsync({
            id: row.original.id,
            title: values.title,
            message: values.message,
            startDate: values.startDate,
            endDate: values.endDate,
            monitors: values.monitors,
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
