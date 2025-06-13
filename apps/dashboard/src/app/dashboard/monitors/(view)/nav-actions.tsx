"use client";

import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { QuickActions } from "@/components/dropdowns/quick-actions";
import { useRouter } from "next/navigation";
import { getActions } from "@/data/monitors.client";
import { toast } from "sonner";
import { useState } from "react";
import { ExportCodeDialog } from "@/components/dialogs/export-code";

export function NavActions() {
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

  async function testAction() {
    const promise = new Promise((resolve) => setTimeout(resolve, 1000));
    toast.promise(promise, {
      loading: "Checking...",
      success: "Success",
      error: "Failed",
    });
    await promise;
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="hidden font-medium text-muted-foreground lg:inline-block">
        Last ping 5m ago
        <span className="relative ml-1.5 inline-flex">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/80 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
        </span>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={testAction}
            >
              <Zap />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Test Monitor</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <QuickActions
        actions={actions}
        deleteAction={{
          title: "Monitor",
          confirmationValue: "delete monitor",
        }}
      />
      <ExportCodeDialog open={openDialog} onOpenChange={setOpenDialog} />
    </div>
  );
}
