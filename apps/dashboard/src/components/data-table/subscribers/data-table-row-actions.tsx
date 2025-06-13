"use client";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import type { Row } from "@tanstack/react-table";

interface DataTableRowActionsProps<TData> {
  row?: Row<TData>;
}

export function DataTableRowActions<TData>(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _props: DataTableRowActionsProps<TData>,
) {
  return (
    <QuickActions
      actions={[]}
      deleteAction={{
        title: "Subscribers",
      }}
    />
  );
}
