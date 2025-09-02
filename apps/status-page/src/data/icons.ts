"use client";

import { Activity, AlertCircle, SearchCheck } from "lucide-react";

export const status = {
  operational: SearchCheck,
  investigating: AlertCircle,
  identified: AlertCircle,
  monitoring: Activity,
} as const;

export const icons = {
  status,
};
