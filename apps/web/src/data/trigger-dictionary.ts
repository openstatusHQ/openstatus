import type { ValidIcon } from "@/components/icons";
import type { Trigger } from "@/lib/monitor/utils";

export const triggerDict = {
  cron: {
    value: "cron",
    label: "Scheduled",
    icon: "clock",
  },
  api: {
    value: "api",
    label: "On-Demand",
    icon: "network",
  },
  unknown: {
    value: "unknown",
    label: "Unknown",
    icon: "cog",
  },
} satisfies Record<
  string,
  {
    icon: ValidIcon;
    label: string;
    value: Trigger | "unknown";
  }
>;
