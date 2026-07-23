"use client";

import type { RouterOutputs } from "@openstatus/api";
import {
  StatusBar,
  StatusBarSkeleton,
} from "@openstatus/ui/components/blocks/status-bar";
import {
  StatusComponent,
  StatusComponentBody,
  StatusComponentDescription,
  StatusComponentFooter,
  StatusComponentHeader,
  StatusComponentHeaderLeft,
  StatusComponentHeaderRight,
  StatusComponentIcon,
  StatusComponentStatus,
  StatusComponentTitle,
  StatusComponentUptime,
  StatusComponentUptimeSkeleton,
} from "@openstatus/ui/components/blocks/status-component";
import { cn } from "@openstatus/ui/lib/utils";

type VariantType = "success" | "degraded" | "error" | "info";

type Data = NonNullable<
  RouterOutputs["statusPage"]["getUptime"]
>[number]["data"];

/**
 * StatusComponentStatic — non-interactive status-component card used by the
 * theme playground / static preview at `apps/(public)/client.tsx`. Composes
 * the canonical block primitives directly; no Link wiring (no live page).
 */
export function StatusComponentStatic({
  className,
  status = "success",
  showUptime = true,
  data = [],
  monitor,
  uptime,
  isLoading = false,
}: {
  className?: string;
  status?: VariantType;
  showUptime?: boolean;
  uptime?: string;
  monitor: { name: string; description?: string | null };
  data?: Data;
  isLoading?: boolean;
}) {
  return (
    <StatusComponent variant={status} className={cn(className)}>
      <StatusComponentHeader>
        <StatusComponentHeaderLeft>
          <StatusComponentTitle>{monitor.name}</StatusComponentTitle>
          <StatusComponentDescription>
            {monitor.description}
          </StatusComponentDescription>
        </StatusComponentHeaderLeft>
        <StatusComponentHeaderRight>
          {showUptime ? (
            <>
              {isLoading ? (
                <StatusComponentUptimeSkeleton />
              ) : (
                <StatusComponentUptime>{uptime}</StatusComponentUptime>
              )}
              <StatusComponentIcon />
            </>
          ) : (
            <StatusComponentStatus />
          )}
        </StatusComponentHeaderRight>
      </StatusComponentHeader>
      <StatusComponentBody>
        {isLoading ? <StatusBarSkeleton /> : <StatusBar data={data} />}
        <StatusComponentFooter data={data} isLoading={isLoading} />
      </StatusComponentBody>
    </StatusComponent>
  );
}
