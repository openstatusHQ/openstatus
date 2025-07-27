"use client";

import { Activity, AlertCircle, Search, SearchCheck } from "lucide-react";

export const status = {
  resolved: SearchCheck,
  investigating: AlertCircle,
  identified: Search,
  monitoring: Activity,
} as const;

export const icons = {
  status,
};
