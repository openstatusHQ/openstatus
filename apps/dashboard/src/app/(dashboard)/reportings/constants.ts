import { Incident, Monitor } from "@openstatus/icons";

// next.config.ts redirects the section root to the first entry.
export const REPORTING_TABS = [
  {
    value: "monitors",
    label: "Monitors",
    icon: Monitor,
    href: "/reportings/monitors",
  },
  {
    value: "incidents",
    label: "Incidents",
    icon: Incident,
    href: "/reportings/incidents",
  },
] as const;
