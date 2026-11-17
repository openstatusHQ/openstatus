import type { RouterOutputs } from "@openstatus/api";
import { FileText, History, Megaphone, SlidersHorizontal } from "lucide-react";

import { NAV } from "@/config/nav";

import type { CommandMenuGroup, CommandMenuItem, CommandPage } from "../types";
import { addStatusReportUpdateItem, statusReportItem } from "./static";

export const INCIDENT_ANCHORS = [
  { id: "activity", label: "Activity", icon: History },
  { id: "postmortem", label: "Postmortem", icon: FileText },
  { id: "properties", label: "Properties", icon: SlidersHorizontal },
  { id: "communication", label: "Communication", icon: Megaphone },
];

type Incident = RouterOutputs["incident"]["list"][number];
type StatusReport = RouterOutputs["statusReport"]["list"][number];

export function incidentScopeGroups({
  page,
  incidents,
  statusReports,
}: {
  page: Extract<CommandPage, { type: "incident" }>;
  incidents: Incident[] | undefined;
  statusReports: StatusReport[] | undefined;
}): CommandMenuGroup[] {
  const incident = incidents?.find((i) => i.id === page.id);
  // The incident list embeds the report without its page; the route needs it.
  const report = statusReports?.find(
    (r) => r.id === incident?.statusReport?.id,
  );
  // A canceled incident is a false alarm: the page renders no postmortem.
  const anchors = INCIDENT_ANCHORS.filter(
    (a) => a.id !== "postmortem" || incident?.status !== "canceled",
  );

  const reportItems: CommandMenuItem[] = report
    ? [
        ...(report.status !== "resolved"
          ? [addStatusReportUpdateItem(report)]
          : []),
        statusReportItem(report),
      ]
    : [];

  return [
    {
      heading: page.title,
      key: "incident",
      items: [
        {
          value: "Open Incident",
          label: "Open Incident",
          icon: NAV.incidents.icon,
          action: { type: "navigate", href: `/incidents/${page.id}` },
        },
        ...anchors.map((anchor) => ({
          value: anchor.label,
          label: anchor.label,
          icon: anchor.icon,
          action: {
            type: "navigate" as const,
            href: `/incidents/${page.id}#${anchor.id}`,
          },
        })),
      ],
    },
    { heading: "Status Report", key: "report", items: reportItems },
  ];
}
