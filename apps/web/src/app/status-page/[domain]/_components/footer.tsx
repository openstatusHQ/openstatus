import { allPlans } from "@openstatus/db/src/schema/plan/config";
import type { WorkspacePlan } from "@openstatus/db/src/schema/workspaces/validation";

import { ThemeToggle } from "@/components/theme/theme-toggle";

interface Props {
  plan: WorkspacePlan;
  timeZone?: string | null;
}

export function Footer({ plan, timeZone }: Props) {
  const isWhiteLabel = allPlans[plan].limits["white-label"]; // FIXME: use the workspace.limits
  return (
    <footer className="z-10 mx-auto grid w-full grid-cols-5 items-center justify-between gap-4">
      <p className="truncate font-light text-muted-foreground text-xs">
        {timeZone}
      </p>
      <div className="col-span-3 w-full">
        {!isWhiteLabel ? (
          <p className="text-center text-muted-foreground text-sm">
            powered by{" "}
            <a
              href="https://www.openstatus.dev"
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline underline-offset-4 hover:no-underline"
            >
              openstatus.dev
            </a>
          </p>
        ) : null}
      </div>
      <div className="text-right">
        <ThemeToggle />
      </div>
    </footer>
  );
}
