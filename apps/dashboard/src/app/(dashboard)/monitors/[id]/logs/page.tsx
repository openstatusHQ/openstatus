import { CONTROLS_COOKIE_NAME } from "@openstatus/ui/lib/data-table-filters/cookie";

import { getSidebarDefaultOpen } from "@/lib/sidebar-cookie";

import { Client } from "./client";

export default async function Page() {
  const controlsDefaultOpen = await getSidebarDefaultOpen(
    CONTROLS_COOKIE_NAME,
    true,
  );
  return <Client controlsDefaultOpen={controlsDefaultOpen} />;
}
