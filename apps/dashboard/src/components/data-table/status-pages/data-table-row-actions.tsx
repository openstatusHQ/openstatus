"use client";

import { Row } from "@tanstack/react-table";
import { QuickActions } from "@/components/dropdowns/quick-actions";
import { useRouter } from "next/navigation";
import { getActions } from "@/data/status-pages.client";
import { toast } from "sonner";

interface DataTableRowActionsProps<TData> {
  row?: Row<TData>;
}

export function DataTableRowActions<TData>(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _props: DataTableRowActionsProps<TData>
) {
  const router = useRouter();
  const actions = getActions({
    edit: () => router.push(`/dashboard/status-pages/edit`),
    "copy-id": () => {
      navigator.clipboard.writeText("ID");
      toast.success("Monitor ID copied to clipboard");
    },
  });

  return (
    <QuickActions
      actions={actions}
      deleteAction={{
        title: "Status Page",
        confirmationValue: "status page",
      }}
    />
  );
}
