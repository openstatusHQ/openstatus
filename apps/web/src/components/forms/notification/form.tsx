"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";

import type {
  InsertNotification,
  InsertNotificationWithData,
  Monitor,
  NotificationProvider,
  WorkspacePlan,
} from "@openstatus/db/src/schema";
import { InsertNotificationWithDataSchema } from "@openstatus/db/src/schema";
import { Badge, Form } from "@openstatus/ui";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/dashboard/tabs";
import { toast, toastAction } from "@/lib/toast";
import { api } from "@/trpc/client";
import { TRPCClientError } from "@trpc/client";
import { SaveButton } from "../shared/save-button";
import { General } from "./general";
import { SectionConnect } from "./section-connect";

interface Props {
  defaultValues?: InsertNotification;
  defaultSection?: string;
  onSubmit?: () => void;
  monitors?: Monitor[];
  workspacePlan: WorkspacePlan;
  nextUrl?: string;
  provider: NotificationProvider;
  callbackData?: string;
}

export function NotificationForm({
  defaultValues,
  defaultSection = "connect",
  onSubmit: onExternalSubmit,
  workspacePlan,
  monitors,
  nextUrl,
  provider,
  callbackData,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<InsertNotificationWithData>({
    resolver: zodResolver(InsertNotificationWithDataSchema),
    defaultValues: {
      ...defaultValues,
      provider,
      name: defaultValues?.name || "",
      data: JSON.parse(defaultValues?.data || "{}"),
    },
  });

  async function onSubmit({
    provider,
    data,
    ...rest
  }: InsertNotificationWithData) {
    console.log({ provider, data, ...rest });
    startTransition(async () => {
      try {
        if (provider === "pagerduty") {
          if (callbackData) {
            data.pagerduty = callbackData;
          }
        }
        if (defaultValues) {
          await api.notification.update.mutate({
            provider,
            data: JSON.stringify(data),
            ...rest,
          });
        } else {
          await api.notification.create.mutate({
            provider,
            data: JSON.stringify(data),
            ...rest,
          });
        }
        if (nextUrl) {
          router.push(nextUrl);
        }
        router.refresh();
        toastAction("saved");
      } catch (e) {
        if (e instanceof TRPCClientError) toast.error(e.message);
        else toastAction("error");
      } finally {
        onExternalSubmit?.();
      }
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        id="notification-form" // we use a form id to connect the submit button to the form (as we also have the form nested inside of `MonitorForm`)
        className="flex flex-col gap-4"
      >
        <General form={form} plan={workspacePlan} />
        <Tabs defaultValue={defaultSection} className="w-full">
          <TabsList>
            <TabsTrigger value="connect">
              Connect{" "}
              {defaultValues?.monitors.length ? (
                <Badge variant="secondary" className="ml-1">
                  {defaultValues?.monitors.length}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="connect">
            <SectionConnect form={form} monitors={monitors} />
          </TabsContent>
        </Tabs>
        <div className="flex gap-4 sm:justify-end">
          <SaveButton
            form="notification-form"
            isPending={isPending}
            isDirty={form.formState.isDirty}
            onSubmit={form.handleSubmit(onSubmit)}
          />
        </div>
      </form>
    </Form>
  );
}
