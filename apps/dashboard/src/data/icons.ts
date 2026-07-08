"use client";

import { Activity, CircleAlert, Search, SearchCheck } from "@openstatus/icons";

export const status = {
  resolved: SearchCheck,
  investigating: CircleAlert,
  identified: Search,
  monitoring: Activity,
} as const;

export const icons = {
  status,
};
