import type { PrivateLocation } from "@openstatus/db/src/schema";
import { Alert, Success, Failed, Send, Incident } from "@openstatus/icons";
import { getRegionInfo } from "@openstatus/regions";

import { formatMilliseconds } from "@/lib/formatter";

export const config = {
  "incident.created": {
    icon: Incident,
    color: "text-destructive",
    title: "Incident Created",
  },
  "incident.resolved": {
    icon: Success,
    color: "text-success",
    title: "Incident Resolved",
  },
  "monitor.failed": {
    icon: Failed,
    color: "text-destructive",
    title: "Monitor Failed",
  },
  "notification.sent": {
    icon: Send,
    color: "text-info",
    title: "Notification Sent",
  },
  "monitor.recovered": {
    icon: Success,
    color: "text-success",
    title: "Monitor Recovered",
  },
  "monitor.degraded": {
    icon: Alert,
    color: "text-warning",
    title: "Monitor Degraded",
  },
} as const;

export const getMetadata = (privateLocations?: PrivateLocation[]) => {
  return {
    region: {
      label: "Region",
      key: "region",
      unit: undefined,
      visible: () => true,
      format: (value) => {
        const regionInfo = getRegionInfo(`${value}`, {
          location: privateLocations?.find(
            (location) => String(location.id) === String(value),
          )?.name,
        });
        return `${regionInfo.location} (${regionInfo.provider})`;
      },
    },
    cronTimestamp: {
      label: "Timestamp",
      key: "timestamp",
      unit: undefined,
      visible: () => false,
      format: (value) => String(value),
    },
    statusCode: {
      label: "Status Code",
      key: "status",
      unit: undefined,
      visible: (_value) => typeof _value === "number" && _value !== -1,
      format: (value) => String(value),
    },
    latency: {
      label: "Latency",
      key: "latency",
      unit: "ms",
      visible: () => true,
      format: (value) => formatMilliseconds(Number(value)),
    },
    provider: {
      label: "Provider",
      key: "provider",
      unit: undefined,
      visible: () => true,
      format: (value) => String(value),
    },
  } as const satisfies Record<
    string,
    {
      label: string;
      key: string;
      unit?: string | undefined;
      visible: (value: string | number) => boolean;
      format: (value: string | number) => string;
    }
  >;
};
