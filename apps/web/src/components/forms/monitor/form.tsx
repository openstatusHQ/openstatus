"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type {
  InsertMonitor,
  MonitorFlyRegion,
  MonitorTag,
  Notification,
  Page,
  WorkspacePlan,
} from "@openstatus/db/src/schema";
import { flyRegions, insertMonitorSchema } from "@openstatus/db/src/schema";
import { Badge, Form } from "@openstatus/ui";

import type { RegionChecker } from "@/app/play/checker/[id]/utils";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/dashboard/tabs";
import { FailedPingAlertConfirmation } from "@/components/modals/failed-ping-alert-confirmation";
import { toastAction } from "@/lib/toast";
import { api } from "@/trpc/client";
import type { Writeable } from "@/types/utils";
import { SaveButton } from "../shared/save-button";
import { General } from "./general";
import { SectionDanger } from "./section-danger";
import { SectionNotifications } from "./section-notifications";
import { SectionRequests } from "./section-requests";
import { SectionScheduling } from "./section-scheduling";
import { SectionStatusPage } from "./section-status-page";

interface Props {
  defaultSection?: string;
  defaultValues?: InsertMonitor;
  plan?: WorkspacePlan;
  notifications?: Notification[];
  tags?: MonitorTag[];
  pages?: Page[];
  nextUrl?: string;
}

export function MonitorForm({
  defaultSection,
  defaultValues,
  plan = "free",
  notifications,
  pages,
  tags,
  nextUrl,
}: Props) {
  const form = useForm<InsertMonitor>({
    resolver: zodResolver(insertMonitorSchema),
    defaultValues: {
      url: defaultValues?.url || "",
      name: defaultValues?.name || "",
      description: defaultValues?.description || "",
      periodicity: defaultValues?.periodicity || "30m",
      active: defaultValues?.active ?? true,
      id: defaultValues?.id || 0,
      regions:
        defaultValues?.regions || (flyRegions as Writeable<typeof flyRegions>),
      headers: Boolean(defaultValues?.headers?.length)
        ? defaultValues?.headers
        : [{ key: "", value: "" }],
      body: defaultValues?.body ?? "",
      method: defaultValues?.method ?? "GET",
      notifications: defaultValues?.notifications ?? [],
      pages: defaultValues?.pages ?? [],
      tags: defaultValues?.tags ?? [],
    },
  });
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = React.useTransition();
  const [pingFailed, setPingFailed] = React.useState(false);

  const handleDataUpdateOrInsertion = async (props: InsertMonitor) => {
    try {
      if (defaultValues) {
        await api.monitor.update.mutate(props);
      } else {
        await api.monitor.create.mutate(props);
      }
      if (nextUrl) {
        router.push(nextUrl);
      }
      // to reset the `isDirty` state of them form while keeping the values for optimistic UI
      form.reset(undefined, { keepValues: true });
      router.refresh();
      toastAction("saved");
    } catch (error) {
      toastAction("error");
    }
  };

  const onSubmit = ({ ...props }: InsertMonitor) => {
    startTransition(async () => {
      try {
        // const pingResult = await pingEndpoint();
        // const isOk = pingResult?.status >= 200 && pingResult?.status < 300;
        // if (!isOk) {
        //   setPingFailed(true);
        //   return;
        // }
        await handleDataUpdateOrInsertion(props);
      } catch {
        toastAction("error");
      }
    });
  };

  const pingEndpoint = async (region?: MonitorFlyRegion) => {
    const { url, body, method, headers } = form.getValues();
    const res = await fetch(`/api/checker/test`, {
      method: "POST",
      headers: new Headers({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ url, body, method, headers, region }),
    });
    const data = (await res.json()) as RegionChecker;
    return data;
  };

  function onValueChange(value: string) {
    // REMINDER: we are not merging the searchParams here
    // we are just setting the section to allow refreshing the page
    const params = new URLSearchParams();
    params.set("section", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          className="flex w-full flex-col gap-6"
        >
          <General {...{ form, plan, tags }} />
          <Tabs
            defaultValue={defaultSection}
            className="w-full"
            onValueChange={onValueChange}
          >
            <TabsList>
              <TabsTrigger value="request">Request</TabsTrigger>
              <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
              <TabsTrigger value="notifications">
                Notifications{" "}
                {defaultValues?.notifications?.length ? (
                  <Badge variant="secondary" className="ml-1">
                    {defaultValues.notifications.length}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="status-page">
                Status Page{" "}
                {defaultValues?.pages?.length ? (
                  <Badge variant="secondary" className="ml-1">
                    {defaultValues.pages.length}
                  </Badge>
                ) : null}
              </TabsTrigger>
              {defaultValues?.id ? (
                <TabsTrigger value="danger">Danger</TabsTrigger>
              ) : null}
            </TabsList>
            <TabsContent value="request">
              <SectionRequests {...{ form, plan, pingEndpoint }} />
            </TabsContent>
            <TabsContent value="scheduling">
              <SectionScheduling {...{ form, plan }} />
            </TabsContent>
            <TabsContent value="notifications">
              <SectionNotifications {...{ form, plan, notifications }} />
            </TabsContent>
            <TabsContent value="status-page">
              <SectionStatusPage {...{ form, plan, pages }} />
            </TabsContent>
            {defaultValues?.id ? (
              <TabsContent value="danger">
                <SectionDanger monitorId={defaultValues.id} />
              </TabsContent>
            ) : null}
          </Tabs>
          <SaveButton
            isPending={isPending}
            isDirty={form.formState.isDirty}
            onSubmit={form.handleSubmit(onSubmit)}
          />
        </form>
      </Form>
      <FailedPingAlertConfirmation
        monitor={form.getValues()}
        {...{ pingFailed, setPingFailed }}
        onConfirm={handleDataUpdateOrInsertion}
      />
    </>
  );
}
