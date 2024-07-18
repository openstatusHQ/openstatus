"use client";

import { useState } from "react";

import { workspacePlanHierarchy } from "@openstatus/db/src/schema";
import type { WorkspacePlan } from "@openstatus/db/src/schema/workspaces/validation";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@openstatus/ui";

function upgradePlan(current: WorkspacePlan, required: WorkspacePlan) {
  return workspacePlanHierarchy[current] < workspacePlanHierarchy[required];
}

// TBD: we could useParams() to access workspaceSlug

export function ProFeatureHoverCard({
  children,
  plan,
  minRequiredPlan,
  workspaceSlug,
}: {
  children: React.ReactNode;
  plan: WorkspacePlan;
  minRequiredPlan: WorkspacePlan;
  workspaceSlug: string;
}) {
  console.log({ workspaceSlug, plan, minRequiredPlan });
  const [open, setOpen] = useState(false);
  const shouldUpgrade = upgradePlan(plan, minRequiredPlan);

  if (!shouldUpgrade) return children;

  return (
    <HoverCard openDelay={0} open={open} onOpenChange={setOpen}>
      <HoverCardTrigger
        onClick={() => setOpen(true)}
        className="opacity-70"
        asChild
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent side="top" className="grid gap-2">
        <p className="text-muted-foreground text-sm">
          This feature is only available starting from the{" "}
          <span className="font-semibold capitalize">{minRequiredPlan}</span>{" "}
          plan.
        </p>
        <p className="text-sm">
          <a
            href={`/app/${workspaceSlug}/settings/billing`}
            target="_blank"
            className="inline-flex items-center font-medium text-foreground underline underline-offset-4 hover:no-underline"
            rel="noreferrer"
          >
            Upgrade now
          </a>
          .
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}
