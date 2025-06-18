"use client";

import { ExportCodeDialog } from "@/components/dialogs/export-code";
import { QuickActions } from "@/components/dropdowns/quick-actions";
import { getActions } from "@/data/monitors.client";
import { RouterOutputs } from "@openstatus/api";
import type { Row } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type Monitor = RouterOutputs["monitor"]["list"][number];
interface DataTableRowActionsProps {
  row: Row<Monitor>;
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const [openDialog, setOpenDialog] = useState(false);
  const router = useRouter();
  const actions = getActions({
    edit: () => router.push(`/monitors/edit/${row.original.id}`),
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
