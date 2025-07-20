"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useCookieState } from "@/hooks/use-cookie-state";
import { useQuery } from "@tanstack/react-query";
import { NavBannerChecklist } from "./nav-banner-checklist";
import { NavBannerUpgrade } from "./nav-banner-upgrade";

const EXPIRES_IN = 7 * 24 * 60 * 60 * 1000; // in 7 days

export function NavBanner() {
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const [openChecklist, setOpenChecklist] = useCookieState<"true" | "false">(
    "sidebar_banner_checklist",
    "true",
    { expires: EXPIRES_IN }
  );
  const [openUpgrade, setOpenUpgrade] = useCookieState<"true" | "false">(
    "sidebar_banner_upgrade",
    "true",
    { expires: EXPIRES_IN }
  );

  if (!workspace) return null;

  if (openChecklist === "true") {
    return <NavBannerChecklist handleClose={() => setOpenChecklist("false")} />;
  }

  if (openUpgrade === "true" && workspace.plan === "free") {
    return <NavBannerUpgrade handleClose={() => setOpenUpgrade("false")} />;
  }

  return null;
}
