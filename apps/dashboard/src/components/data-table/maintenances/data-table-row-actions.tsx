"use client";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { FormSheetMaintenance } from "@/components/forms/maintenance/sheet";
import { getActions } from "@/data/maintenances.client";
import type { Row } from "@tanstack/react-table";
import { useRef } from "react";

interface DataTableRowActionsProps<TData> {
  row?: Row<TData>;
}

export function DataTableRowActions<TData>(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _props: DataTableRowActionsProps<TData>,
) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const actions = getActions({
    edit: () => buttonRef.current?.click(),
  });

  return (
    <>
      <QuickActions
        actions={actions}
        deleteAction={{
          title: "Delete",
          confirmationValue: "delete",
        }}
      />
      <FormSheetMaintenance>
        <button ref={buttonRef} type="button" className="sr-only">
          Open sheet
        </button>
      </FormSheetMaintenance>
    </>
  );
}
