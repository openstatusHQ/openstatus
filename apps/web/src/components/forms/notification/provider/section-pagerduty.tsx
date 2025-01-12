"use client";

import type { UseFormReturn } from "react-hook-form";

import type {
  InsertNotificationWithData,
  WorkspacePlan,
} from "@openstatus/db/src/schema";

interface Props {
  form: UseFormReturn<InsertNotificationWithData>;
  plan: WorkspacePlan;
}

export function SectionPagerDuty({ form }: Props) {
  return null;
}
