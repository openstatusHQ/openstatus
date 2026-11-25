"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { SidebarMenuItem } from "@openstatus/ui/components/ui/sidebar";
import { useState } from "react";

import { UpgradeDialog } from "../dialogs/upgrade";

export function NavBannerUpgradeAction({
  trialEligible,
}: {
  trialEligible: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <SidebarMenuItem className="pt-1">
        <Button size="sm" className="w-full" onClick={() => setOpen(true)}>
          {trialEligible ? "Start trial" : "Upgrade"}
        </Button>
      </SidebarMenuItem>
      {trialEligible ? (
        <SidebarMenuItem className="text-muted-foreground text-center text-[10px]">
          No credit card needed
        </SidebarMenuItem>
      ) : null}
      <UpgradeDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
