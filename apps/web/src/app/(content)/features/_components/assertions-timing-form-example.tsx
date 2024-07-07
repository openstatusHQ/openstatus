"use client";

import { SectionAssertions } from "@/components/forms/monitor/section-assertions";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  type InsertMonitor,
  insertMonitorSchema,
} from "@openstatus/db/src/schema";
import { Form } from "@openstatus/ui";
import { useForm } from "react-hook-form";

export function AssertionsTimingFormExample() {
  const form = useForm<InsertMonitor>({
    resolver: zodResolver(insertMonitorSchema),
    defaultValues: {
      timeout: 45_000,
    },
  });
  return (
    <Form {...form}>
      <SectionAssertions form={form} />
    </Form>
  );
}
