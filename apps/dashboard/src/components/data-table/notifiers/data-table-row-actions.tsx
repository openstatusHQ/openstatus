"use client";

import { Row } from "@tanstack/react-table";
import { getActions } from "@/data/notifiers.client";
import { QuickActions } from "@/components/dropdowns/quick-actions";
import { useRef } from "react";
import { FormSheetNotifier } from "@/components/forms/notifier/sheet";

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
          confirmationValue: "delete notifier",
        }}
      />
      {/* NOTE: id is provider name */}
      <FormSheetNotifier id="email">
        <button ref={buttonRef} className="sr-only">
          Open sheet
        </button>
      </FormSheetNotifier>
    </>
  );
}
