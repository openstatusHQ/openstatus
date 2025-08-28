import {
  CircleMinus,
  Siren,
  Send,
  CircleCheck,
  CircleAlert,
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
