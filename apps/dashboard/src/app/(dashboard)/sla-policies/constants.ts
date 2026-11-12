import { Incident, Monitor } from "@openstatus/icons";

// The section root redirects to the first entry.
export const SLA_POLICY_TABS = [
  {
    value: "monitors",
    label: "Monitors",
    icon: Monitor,
    href: "/sla-policies/monitors",
  },
  {
    value: "incidents",
    label: "Incidents",
    icon: Incident,
    href: "/sla-policies/incidents",
  },
] as const;
