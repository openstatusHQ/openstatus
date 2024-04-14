import { allPlans } from "@openstatus/plans";
import type { WorkspacePlan } from "@openstatus/plans";

import { ThemeToggle } from "@/components/theme-toggle";

interface Props {
  plan: WorkspacePlan;
}

export function Footer({ plan }: Props) {
  const isWhiteLabel = allPlans[plan].limits["white-label"];
  return (
    <footer className="z-10 mx-auto flex w-full items-center justify-between">
      <div />
      {!isWhiteLabel ? (
        <p className="text-muted-foreground text-center text-sm">
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
      <ThemeToggle />
    </footer>
  );
}
