"use client";

import { useCookieState } from "@openstatus/ui/hooks/use-cookie-state";
import { useQuery } from "@tanstack/react-query";

import { getTrialDaysLeft } from "@/lib/trial";
import { useTRPC } from "@/lib/trpc/client";

import { NavBannerChecklist } from "./nav-banner-checklist";
import { NavBannerTrial } from "./nav-banner-trial";
import { NavBannerUpgrade } from "./nav-banner-upgrade";

const EXPIRES_IN = 7 * 24 * 60 * 60 * 1000; // in 7 days
const TRIAL_BANNER_DAYS = 3;

export function NavBanner() {
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const [openChecklist, setOpenChecklist] = useCookieState<"true" | "false">(
    "sidebar_banner_checklist",
    "true",
    { expires: EXPIRES_IN },
  );
  const [openUpgrade, setOpenUpgrade] = useCookieState<"true" | "false">(
    "sidebar_banner_upgrade",
    "true",
    { expires: EXPIRES_IN },
  );
  const [openTrial, setOpenTrial] = useCookieState<"true" | "false">(
    "sidebar_banner_trial",
    "true",
    { expires: EXPIRES_IN },
  );

  if (!workspace) return null;

  const trialDaysLeft = getTrialDaysLeft(workspace.trialEndsAt);
  if (
    openTrial === "true" &&
    trialDaysLeft !== null &&
    trialDaysLeft <= TRIAL_BANNER_DAYS
  ) {
    return (
      <NavBannerTrial
        workspaceSlug={workspace.slug}
        daysLeft={trialDaysLeft}
        handleClose={() => setOpenTrial("false")}
      />
    );
  }

  if (openChecklist === "true") {
    return <NavBannerChecklist handleClose={() => setOpenChecklist("false")} />;
  }

  if (openUpgrade === "true" && workspace.plan === "free") {
    return <NavBannerUpgrade handleClose={() => setOpenUpgrade("false")} />;
  }

  return null;
}
