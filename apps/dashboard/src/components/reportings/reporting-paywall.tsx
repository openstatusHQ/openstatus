"use client";

import { Lock } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useState } from "react";

import {
  EmptyStateActions,
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateMedia,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import { SectionGroup } from "@/components/content/section";
import { UpgradeDialog } from "@/components/dialogs/upgrade";

export function ReportingPaywall() {
  const [open, setOpen] = useState(false);
  return (
    <SectionGroup>
      <EmptyStateContainer>
        <EmptyStateMedia>
          <Lock />
        </EmptyStateMedia>
        <EmptyStateTitle>Reportings are not on your plan</EmptyStateTitle>
        <EmptyStateDescription>
          Upgrade to see how each monitor did against its target, month by
          month.
        </EmptyStateDescription>
        <EmptyStateActions>
          <Button
            size="sm"
            data-track="paywall_viewed"
            data-limit="monitor-sla"
            onClick={() => setOpen(true)}
          >
            Upgrade
          </Button>
        </EmptyStateActions>
      </EmptyStateContainer>
      <UpgradeDialog open={open} onOpenChange={setOpen} limit="monitor-sla" />
    </SectionGroup>
  );
}
