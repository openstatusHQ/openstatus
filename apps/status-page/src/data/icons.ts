"use client";

import { Monitor, Alert, Resolved } from "@openstatus/icons";

export const status = {
  operational: Resolved,
  investigating: Alert,
  identified: Alert,
  monitoring: Monitor,
} as const;

export const icons = {
  status,
};
