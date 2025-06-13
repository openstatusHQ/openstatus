"use client";

import { Activity, SearchCheck } from "lucide-react";

export const status = {
  operational: SearchCheck,
  investigating: Activity,
} as const;

export const icons = {
  status,
};
