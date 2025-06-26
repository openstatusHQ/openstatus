import { formatMilliseconds } from "@/lib/formatter";
import {
  CircleAlert,
  CircleCheck,
  CircleMinus,
  Send,
  Siren,
} from "lucide-react";

export const config = {
  "incident.created": {
    icon: Siren,
    color: "text-destructive",
    title: "Incident Created",
  },
  "incident.resolved": {
    icon: CircleCheck,
    color: "text-success",
    title: "Incident Resolved",
  },
  "monitor.failed": {
    icon: CircleMinus,
    color: "text-destructive",
    title: "Monitor Failed",
  },
  "notification.sent": {
    icon: Send,
    color: "text-info",
    title: "Notification Sent",
  },
  "monitor.recovered": {
    icon: CircleCheck,
    color: "text-success",
    title: "Monitor Recovered",
  },
  "monitor.degraded": {
    icon: CircleAlert,
    color: "text-warning",
    title: "Monitor Degraded",
  },
} as const;

export const metadata = {
  region: {
    label: "Region",
    key: "region",
    unit: undefined,
    visible: () => true,
    format: (value) => String(value),
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
