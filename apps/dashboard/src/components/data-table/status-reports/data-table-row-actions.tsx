"use client";

import { Row } from "@tanstack/react-table";
import { getActions } from "@/data/status-reports.client";
import { QuickActions } from "@/components/dropdowns/quick-actions";
import { FormSheetStatusReport } from "@/components/forms/status-report/sheet";
import { useRef } from "react";
import { FormSheetStatusReportUpdate } from "@/components/forms/status-report-update/sheet";

interface DataTableRowActionsProps<TData> {
  row?: Row<TData>;
}

export function DataTableRowActions<TData>(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  props: DataTableRowActionsProps<TData>
) {
  const buttonCreateRef = useRef<HTMLButtonElement>(null);
  const buttonUpdateRef = useRef<HTMLButtonElement>(null);
  const actions = getActions({
    edit: () => buttonCreateRef.current?.click(),
    "create-update": () => buttonUpdateRef.current?.click(),
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
      <FormSheetStatusReport>
        <button ref={buttonCreateRef} className="sr-only">
          Open sheet
        </button>
      </FormSheetStatusReport>
      <FormSheetStatusReportUpdate>
        <button ref={buttonUpdateRef} className="sr-only">
          Open sheet
        </button>
      </FormSheetStatusReportUpdate>
    </>
  );
}
