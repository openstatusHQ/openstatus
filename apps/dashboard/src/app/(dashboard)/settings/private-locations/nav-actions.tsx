"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { UpgradeDialog } from "@/components/dialogs/upgrade";
import { FormSheetPrivateLocationCreate } from "@/components/forms/private-location/sheet-create";
import { NavFeedback } from "@/components/nav/nav-feedback";
import { useTRPC } from "@/lib/trpc/client";

export function NavActions() {
  const trpc = useTRPC();
  const [openDialog, setOpenDialog] = useState(false);
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: monitors } = useQuery(trpc.monitor.list.queryOptions());

  if (!workspace || !monitors) return null;

  const limitReached = !workspace.limits["private-locations"];

  return (
    <div className="flex items-center gap-2 text-sm">
      <NavFeedback />
      {limitReached ? (
        <Button
          data-track="paywall_viewed"
          data-limit="private-locations"
          size="sm"
          data-disabled={limitReached}
          className="data-[disabled=true]:opacity-50"
          onClick={() => setOpenDialog(true)}
        >
          Create Private Location
        </Button>
      ) : (
        <FormSheetPrivateLocationCreate monitors={monitors}>
          <Button size="sm">Create Private Location</Button>
        </FormSheetPrivateLocationCreate>
      )}
      <UpgradeDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        limit="private-locations"
      />
    </div>
  );
}
