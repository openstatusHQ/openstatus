"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { UpgradeDialog } from "@/components/dialogs/upgrade";
import { useTRPC } from "@/lib/trpc/client";

/** Primary action of the list; opens the paywall once the plan's monitors are used up. */
export function CreateMonitorButton() {
  const trpc = useTRPC();
  const [openDialog, setOpenDialog] = useState(false);
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: monitors } = useQuery(trpc.monitor.list.queryOptions());

  if (!workspace || !monitors) return null;

  const limitReached = monitors.length >= workspace.limits.monitors;

  return (
    <>
      {limitReached ? (
        <Button
          data-section="action"
          data-track="paywall_viewed"
          data-limit="monitors"
          size="sm"
          data-limited={limitReached}
          className="data-[limited=true]:opacity-80"
          onClick={() => setOpenDialog(true)}
        >
          Create monitor
        </Button>
      ) : (
        <Button data-section="action" size="sm" asChild>
          <Link href="/monitors/create">Create monitor</Link>
        </Button>
      )}
      <UpgradeDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        limit="monitors"
      />
    </>
  );
}
