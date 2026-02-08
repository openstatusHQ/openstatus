"use client";

import { UpgradeDialog } from "@/components/dialogs/upgrade";
import { NavFeedback } from "@/components/nav/nav-feedback";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@openstatus/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

export function NavActions() {
  const [openDialog, setOpenDialog] = useState(false);
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: statusPages } = useQuery(trpc.page.list.queryOptions());

  if (!workspace || !statusPages) return null;

  const limitReached = statusPages.length >= workspace.limits["status-pages"];

  return (
    <div className="flex items-center gap-2 text-sm">
      <NavFeedback />
      {limitReached ? (
        <Button
          size="sm"
          data-limited={limitReached}
          className="data-[limited=true]:opacity-80"
          onClick={() => setOpenDialog(true)}
        >
          Create Status Page
        </Button>
      ) : (
        <Button size="sm" asChild>
          <Link href="/status-pages/create">Create Status Page</Link>
        </Button>
      )}
      <UpgradeDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        limit="status-pages"
      />
    </div>
  );
}
