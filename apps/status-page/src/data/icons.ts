"use client";

import { Activity, CircleAlert, SearchCheck } from "@openstatus/icons";

export const status = {
  operational: SearchCheck,
  investigating: CircleAlert,
  identified: CircleAlert,
  monitoring: Activity,
} as const;

export const icons = {
  status,
};
