"use client";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/lib/trpc/client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { NavFeedback } from "@/components/nav/nav-feedback";
import { UpgradeDialog } from "@/components/dialogs/upgrade";
import { useState } from "react";

export function NavActions() {
  const trpc = useTRPC();
  const [openDialog, setOpenDialog] = useState(false);
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: monitors } = useQuery(trpc.monitor.list.queryOptions());

  if (!workspace || !monitors) return null;

  const limitReached = monitors.length >= workspace.limits["monitors"];

  return (
    <div className="flex items-center gap-2 text-sm">
      <NavFeedback />
      {limitReached ? (
        <Button
          size="sm"
          data-disabled={limitReached}
          className="data-[disabled=true]:opacity-50"
          onClick={() => setOpenDialog(true)}
        >
          Create Monitor
        </Button>
      ) : (
        <Button size="sm" asChild>
          <Link href="/monitors/create">Create Monitor</Link>
        </Button>
      )}
      <UpgradeDialog open={openDialog} onOpenChange={setOpenDialog} />
    </div>
  );
}
