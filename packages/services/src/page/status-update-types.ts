import type { pageAccessTypes } from "@openstatus/db/src/schema/pages/constants";

type PageAccessType = (typeof pageAccessTypes)[number];

export type StatusUpdateType = "email" | "slack" | "rss" | "json";

export function getStatusUpdateTypes(args: {
  accessType: PageAccessType;
  emailSubscriptionsEnabled: boolean;
}): StatusUpdateType[] {
  // Feeds cannot authenticate visitors to email-domain pages.
  if (args.accessType === "email-domain") {
    return args.emailSubscriptionsEnabled ? ["email"] : [];
  }

  return args.emailSubscriptionsEnabled
    ? ["email", "slack", "rss", "json"]
    : ["slack", "rss", "json"];
}
