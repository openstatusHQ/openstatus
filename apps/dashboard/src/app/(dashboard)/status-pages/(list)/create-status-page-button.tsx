"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { UpgradeDialog } from "@/components/dialogs/upgrade";
import { useTRPC } from "@/lib/trpc/client";

/** Primary action of the list; opens the paywall once the plan's pages are used up. */
export function CreateStatusPageButton() {
  const [openDialog, setOpenDialog] = useState(false);
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: statusPages } = useQuery(trpc.page.list.queryOptions());

  if (!workspace || !statusPages) return null;

  const limitReached = statusPages.length >= workspace.limits["status-pages"];

  return (
    <>
      {limitReached ? (
        <Button
          data-section="action"
          data-track="paywall_viewed"
          data-limit="status-pages"
          size="sm"
          data-limited={limitReached}
          className="data-[limited=true]:opacity-80"
          onClick={() => setOpenDialog(true)}
        >
          Create status page
        </Button>
      ) : (
        <Button data-section="action" size="sm" asChild>
          <Link href="/status-pages/create">Create status page</Link>
        </Button>
      )}
      <UpgradeDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        limit="status-pages"
      />
    </>
  );
}
