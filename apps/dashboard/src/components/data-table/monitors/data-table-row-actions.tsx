"use client";

import { Row } from "@tanstack/react-table";
import { QuickActions } from "@/components/dropdowns/quick-actions";
import { useRouter } from "next/navigation";
import { getActions } from "@/data/monitors.client";
import { toast } from "sonner";
import { useState } from "react";
import { ExportCodeDialog } from "@/components/dialogs/export-code";

interface DataTableRowActionsProps<TData> {
  row?: Row<TData>;
}

export function DataTableRowActions<TData>(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _props: DataTableRowActionsProps<TData>
) {
  const [openDialog, setOpenDialog] = useState(false);
  const router = useRouter();
  const actions = getActions({
    edit: () => router.push(`/dashboard/monitors/edit`),
    "copy-id": () => {
      navigator.clipboard.writeText("ID");
      toast.success("Monitor ID copied to clipboard");
    },
    export: () => setOpenDialog(true),
  });

  return (
    <>
      <QuickActions
        actions={actions}
        deleteAction={{
          title: "Monitor",
          confirmationValue: "monitor",
        }}
      />
      <ExportCodeDialog open={openDialog} onOpenChange={setOpenDialog} />
    </>
  );
}
