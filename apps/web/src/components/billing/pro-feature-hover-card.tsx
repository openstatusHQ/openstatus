"use client";

import { useState } from "react";

import type { WorkspacePlan } from "@openstatus/db/src/schema/workspaces/validation";
import {
  Badge,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@openstatus/ui";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { upgradePlan } from "./utils";

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
  const [open, setOpen] = useState(false);
  const shouldUpgrade = upgradePlan(plan, minRequiredPlan);

  if (!shouldUpgrade) return children;

  // TODO: add a <Badge /> component to display the plan name

  return (
    <HoverCard openDelay={0} open={open} onOpenChange={setOpen}>
      <HoverCardTrigger
        onClick={() => setOpen(true)}
        className="relative cursor-not-allowed opacity-70"
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
          <Link
            href={`/app/${workspaceSlug}/settings/billing`}
            target="_blank"
            className="group inline-flex items-center font-medium text-foreground underline underline-offset-4 hover:no-underline"
          >
            Upgrade now
            <ArrowUpRight className="ml-1 h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-foreground" />
          </Link>
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}
