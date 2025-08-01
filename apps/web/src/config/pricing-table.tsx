import type { Limits } from "@openstatus/db/src/schema/plan/schema";
import Link from "next/link";
import type React from "react";

import { type Changelog, allChangelogs } from "content-collections";

function renderChangelogDescription(slug: Changelog["slug"]) {
  const changelog = allChangelogs.find((c) => c.slug === slug);
  if (!changelog) return null;
  return (
    <span>
      {changelog?.description}{" "}
      <Link
        href={`/changelog/${changelog.slug}`}
        className="text-nowrap underline underline-offset-4"
      >
        Learn more
      </Link>
      .
    </span>
  );
}

export const pricingTableConfig: Record<
  string,
  {
    label: string;
    features: {
      value: keyof Limits;
      label: string;
      description?: React.ReactNode; // tooltip informations
      badge?: string;
      monthly?: boolean;
    }[];
  }
> = {
  monitors: {
    label: "Monitors",
    features: [
      {
        value: "periodicity",
        label: "Frequency",
      },
      {
        value: "monitors",
        label: "Number of monitors",
      },
      {
        value: "multi-region",
        label: "Multi-region monitoring",
      },
      { value: "regions", label: "Total regions" },
      { value: "max-regions", label: "Regions per monitor" },
      { value: "data-retention", label: "Data retention" },
      { value: "response-logs", label: "Response logs" },
      { value: "otel", label: "OTel Exporter" },
      {
        value: "synthetic-checks",
        label: "Number of on-demand checks",
        monthly: true,
      },
    ],
  },
  "status-pages": {
    label: "Status Pages",
    features: [
      {
        value: "status-pages",
        label: "Number of status pages",
      },
      {
        value: "maintenance",
        label: "Maintenance status",
      },
      {
        value: "monitor-values-visibility",
        label: "Toggle numbers visibility",
        description: renderChangelogDescription(
          "status-page-monitor-values-visibility",
        ),
      },
      {
        value: "status-subscribers",
        label: "Subscribers",
      },
      {
        value: "custom-domain",
        label: "Custom domain",
      },
      {
        value: "password-protection",
        label: "Password-protected",
        description: renderChangelogDescription(
          "password-protected-status-page",
        ),
      },
    ],
  },
  alerts: {
    label: "Alerts",
    features: [
      {
        value: "notifications",
        label: "Slack, Discord, Email, Webhook, ntfy.sh",
      },
      {
        value: "sms",
        label: "SMS",
      },
      {
        value: "pagerduty",
        label: "PagerDuty",
      },
      {
        value: "notification-channels",
        label: "Number of notification channels",
      },
    ],
  },
  collaboration: {
    label: "Collaboration",
    features: [
      {
        value: "members",
        label: "Team members",
      },
      {
        value: "audit-log",
        label: "Audit log",
        badge: "Planned",
      },
    ],
  },
};
