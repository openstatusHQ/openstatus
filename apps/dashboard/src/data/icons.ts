"use client";

import { Monitor, Alert, Search, Resolved } from "@openstatus/icons";

export const status = {
  resolved: Resolved,
  investigating: Alert,
  identified: Search,
  monitoring: Monitor,
} as const;

export const icons = {
  status,
};
