"use client";

import { ExportCodeDialog } from "@/components/dialogs/export-code";
import { QuickActions } from "@/components/dropdowns/quick-actions";
import { getActions } from "@/data/monitors.client";
import type { Row } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface DataTableRowActionsProps<TData> {
  row?: Row<TData>;
}

export function DataTableRowActions<TData>(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _props: DataTableRowActionsProps<TData>,
) {
  const [openDialog, setOpenDialog] = useState(false);
  const router = useRouter();
  const actions = getActions({
    edit: () => router.push("/dashboard/monitors/edit"),
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
