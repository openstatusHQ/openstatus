"use client";

import { SectionAssertions } from "@/components/forms/monitor/section-assertions";
import { zodResolver } from "@hookform/resolvers/zod";
import * as assertions from "@openstatus/assertions";
import {
  type InsertMonitor,
  insertMonitorSchema,
} from "@openstatus/db/src/schema";
import { Form } from "@openstatus/ui";
import { useForm } from "react-hook-form";

const _assertions =
  '[{"version":"v1","type":"header","compare":"eq","key":"Server","target":"Vercel"}]';

export function AssertionsTimingFormExample() {
  const form = useForm<InsertMonitor>({
    resolver: zodResolver(insertMonitorSchema),
    defaultValues: {
      timeout: 45_000,
      headerAssertions: assertions
        .deserialize(_assertions)
        .map((a) => a.schema)
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        .filter((a) => a.type === "header") as any,
    },
  });
  return (
    <Form {...form}>
      <SectionAssertions form={form} />
    </Form>
  );
}
