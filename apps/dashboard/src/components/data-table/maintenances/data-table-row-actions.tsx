"use client";

import { Row } from "@tanstack/react-table";
import { getActions } from "@/data/maintenances.client";
import { QuickActions } from "@/components/dropdowns/quick-actions";
import { useRef } from "react";
import { FormSheetMaintenance } from "@/components/forms/maintenance/sheet";

interface DataTableRowActionsProps<TData> {
  row?: Row<TData>;
}

export function DataTableRowActions<TData>(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _props: DataTableRowActionsProps<TData>
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
        <button ref={buttonRef} className="sr-only">
          Open sheet
        </button>
      </FormSheetMaintenance>
    </>
  );
}
