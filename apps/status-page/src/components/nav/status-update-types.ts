import type { RouterOutputs } from "@openstatus/api";

import type { StatusUpdateType } from "../status-page/status-updates";

type Page = Pick<
  NonNullable<RouterOutputs["statusPage"]["get"]>,
  "accessType" | "emailSubscriptionsEnabled"
>;

export function getStatusUpdateTypes(
  page: Page | null | undefined,
): StatusUpdateType[] {
  if (!page) return [];

  // RSS and JSON are unavailable on email-domain pages because they cannot authenticate.
  if (page.accessType === "email-domain") {
    return page.emailSubscriptionsEnabled ? ["email"] : [];
  }

  if (!page.emailSubscriptionsEnabled) {
    return ["slack", "rss", "json"];
  }

  return ["email", "slack", "rss", "json"];
}
