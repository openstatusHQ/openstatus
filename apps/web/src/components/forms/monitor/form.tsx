"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type {
  InsertMonitor,
  MonitorFlyRegion,
  Notification,
  Page,
  WorkspacePlan,
} from "@openstatus/db/src/schema";
import { flyRegions, insertMonitorSchema } from "@openstatus/db/src/schema";
import { Badge, Button, Form } from "@openstatus/ui";

import type { RegionChecker } from "@/app/play/checker/[id]/utils";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/dashboard/tabs";
import { Kbd } from "@/components/kbd";
import { LoadingAnimation } from "@/components/loading-animation";
import { FailedPingAlertConfirmation } from "@/components/modals/failed-ping-alert-confirmation";
import { useToastAction } from "@/hooks/use-toast-action";
import { api } from "@/trpc/client";
import type { Writeable } from "@/types/utils";
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
  pages?: Page[];
  nextUrl?: string;
}

export function MonitorForm({
  defaultSection,
  defaultValues,
  plan = "free",
  notifications,
  pages,
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
    },
  });
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = React.useTransition();
  const [pingFailed, setPingFailed] = React.useState(false);
  const { toast } = useToastAction();

  React.useEffect(() => {
    const callback = (event: KeyboardEvent) => {
      // event.metaKey - pressed Command key on Macs
      // event.ctrlKey - pressed Control key on Linux or Windows
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        form.handleSubmit(onSubmit)();
      }
    };
    document.addEventListener("keydown", callback);
    return () => {
      document.removeEventListener("keydown", callback);
    };
    // no need to listen to `onSubmit` changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

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
      toast("saved");
    } catch (error) {
      toast("error");
    }
  };

  const onSubmit = ({ ...props }: InsertMonitor) => {
    startTransition(async () => {
      try {
        const pingResult = await pingEndpoint();
        const isOk = pingResult?.status >= 200 && pingResult?.status < 300;
        if (!isOk) {
          setPingFailed(true);
          return;
        }
        await handleDataUpdateOrInsertion(props);
      } catch {
        toast("error");
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
          <General {...{ form, plan }} />
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
          <div className="grid gap-3 sm:justify-end">
            <div className="flex flex-col gap-6 sm:col-span-full sm:flex-row sm:justify-end">
              <Button
                className="w-full sm:w-auto"
                size="lg"
                disabled={isPending}
              >
                {!isPending ? (
                  <span className="flex gap-2">
                    Confirm
                    <Kbd>
                      <span>⌘</span>
                      <span>S</span>
                    </Kbd>
                  </span>
                ) : (
                  <LoadingAnimation />
                )}
              </Button>
            </div>
            {form.formState.isDirty ? (
              <p className="text-muted-foreground text-xs">
                You have unsaved changes
              </p>
            ) : null}
          </div>
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
