import type {
  MonitorFlyRegion,
  MonitorPeriodicity,
} from "@openstatus/db/src/schema";

export type Limits = {
  // monitors
  monitors: number;
  periodicity: Partial<MonitorPeriodicity>[];
  "multi-region": boolean;
  "max-regions": number;
  "data-retention": string;
  // status pages
  "status-pages": number;
  maintenance: boolean;
  "status-subscribers": boolean;
  "custom-domain": boolean;
  "password-protection": boolean;
  "white-label": boolean;
  // alerts
  notifications: boolean;
  sms: boolean;
  "notification-channels": number;
  // collaboration
  members: "Unlimited" | number;
  "audit-log": boolean;
  regions: Partial<MonitorFlyRegion>[];
};
