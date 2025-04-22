"use client";

import { SectionNotifications } from "@/components/forms/monitor/section-notifications";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  type InsertMonitor,
  type Notification,
  insertMonitorSchema,
} from "@openstatus/db/src/schema";
import { Form } from "@openstatus/ui";
import { useForm } from "react-hook-form";

const notifications: Notification[] = (
  [
    { name: "Team", provider: "email" },
    { name: "#alerts", provider: "discord" },
    { name: "#alerts", provider: "slack" },
  ] as const
).map((n, i) => ({
  ...n,
  id: i,
  createdAt: new Date(),
  updatedAt: new Date(),
  workspaceId: 1,
  data: "",
}));

export function NotificationsFormExample() {
  const form = useForm<InsertMonitor>({
    resolver: zodResolver(insertMonitorSchema),
    defaultValues: {
      notifications: [0],
    },
  });
  return (
    <Form {...form}>
      <SectionNotifications form={form} notifications={notifications} />
    </Form>
  );
}
