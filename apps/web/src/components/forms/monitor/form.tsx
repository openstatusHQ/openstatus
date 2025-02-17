"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { getLimit } from "@openstatus/db/src/schema/plan/utils";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";

import * as assertions from "@openstatus/assertions";
import type {
  InsertMonitor,
  MonitorTag,
  Notification,
  Page,
  WorkspacePlan,
} from "@openstatus/db/src/schema";
import { insertMonitorSchema } from "@openstatus/db/src/schema";
import { Badge, Form } from "@openstatus/ui";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/dashboard/tabs";
import { FailedPingAlertConfirmation } from "@/components/modals/failed-ping-alert-confirmation";
import type { RegionChecker } from "@/components/ping-response-analysis/utils";
import { toast, toastAction } from "@/lib/toast";
import { formatDuration } from "@/lib/utils";
import { api } from "@/trpc/client";
import type { MonitorFlyRegion } from "@openstatus/db/src/schema/constants";
import type { Limits } from "@openstatus/db/src/schema/plan/schema";
import { SaveButton } from "../shared/save-button";
import { General } from "./general";
import { RequestTestButton } from "./request-test-button";
import { SectionAssertions } from "./section-assertions";
import { SectionDanger } from "./section-danger";
import { SectionNotifications } from "./section-notifications";
import { SectionOtel } from "./section-otel";
import { SectionRequests } from "./section-requests";
import { SectionScheduling } from "./section-scheduling";
import { SectionStatusPage } from "./section-status-page";

interface Props {
  defaultSection?: string;
  limits: Limits;
  plan: WorkspacePlan;
  defaultValues?: InsertMonitor;
  notifications?: Notification[];
  tags?: MonitorTag[];
  pages?: Page[];
  nextUrl?: string;
  withTestButton?: boolean;
}

const ABORT_TIMEOUT = 7_000; // in ms

export function MonitorForm({
  defaultSection,
  defaultValues,
  notifications,
  pages,
  tags,
  nextUrl,
  limits,
  plan,
  withTestButton = true,
}: Props) {
  const _assertions = defaultValues?.assertions
    ? assertions.deserialize(defaultValues?.assertions).map((a) => a.schema)
    : [];

  const form = useForm<InsertMonitor>({
    resolver: zodResolver(insertMonitorSchema),
    defaultValues: {
      url: defaultValues?.url || "",
      name: defaultValues?.name || "",
      description: defaultValues?.description || "",
      periodicity: defaultValues?.periodicity || "30m",
      active: defaultValues?.active ?? true,
      id: defaultValues?.id || 0,
      regions: defaultValues?.regions || getLimit(limits, "regions"),
      headers: defaultValues?.headers?.length
        ? defaultValues?.headers
        : [{ key: "", value: "" }],
      body: defaultValues?.body ?? "",
      method: defaultValues?.method ?? "GET",
      notifications: defaultValues?.notifications ?? [],
      pages: defaultValues?.pages ?? [],
      tags: defaultValues?.tags ?? [],
      public: defaultValues?.public ?? false,
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      statusAssertions: _assertions.filter((a) => a.type === "status") as any, // TS considers a.type === "header"
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      headerAssertions: _assertions.filter((a) => a.type === "header") as any, // TS considers a.type === "status"
      textBodyAssertions: _assertions.filter(
        (a) => a.type === "textBody",
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      ) as any, // TS considers a.type === "textBody"
      degradedAfter: defaultValues?.degradedAfter,
      timeout: defaultValues?.timeout || 45000,
      jobType: defaultValues?.jobType || "http",
      otelEndpoint: defaultValues?.otelEndpoint ?? "",
      otelHeaders: defaultValues?.otelHeaders ?? [],
    },
  });
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, setPending] = React.useState(false);
  const [pingFailed, setPingFailed] = React.useState(false);
  const type = React.useMemo(
    () => (defaultValues ? "update" : "create"),
    [defaultValues],
  );

  const handleDataUpdateOrInsertion = async (props: InsertMonitor) => {
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
  };

  const handleForceDataUpdateOrInsertion = async (props: InsertMonitor) => {
    try {
      handleDataUpdateOrInsertion(props);
      toastAction("saved");
    } catch (_error) {
      toastAction("error");
    }
  };

  const onSubmit = ({ ...props }: InsertMonitor) => {
    toast.promise(
      async () => {
        setPending(true);
        const { error } = await pingEndpoint();
        if (error) {
          setPingFailed(true);
          throw new Error(error);
        }
        await handleDataUpdateOrInsertion(props);
      },
      {
        loading: "Checking the endpoint before saving...",
        success: () => "Endpoint is working fine. Saved!",
        error: (error: Error) => {
          if (error instanceof Error) return error.message;
          return "Endpoint is not working.";
        },
        finally: () => {
          setPending(false);
        },
      },
    );
  };

  const validateJSON = (value?: string) => {
    if (!value) return;
    try {
      const obj = JSON.parse(value) as Record<string, unknown>;
      form.clearErrors("body");
      return obj;
    } catch (_e) {
      form.setError("body", {
        message: "Not a valid JSON object",
      });
      return false;
    }
  };

  const pingEndpoint = async (region?: MonitorFlyRegion) => {
    try {
      const {
        url,
        body,
        method,
        headers,
        statusAssertions,
        headerAssertions,
        textBodyAssertions,
        jobType,
      } = form.getValues();

      if (
        body &&
        body !== "" &&
        headers?.some(
          (h) => h.key === "Content-Type" && h.value === "application/json",
        )
      ) {
        const validJSON = validateJSON(body);
        if (!validJSON) {
          return { error: "Not a valid JSON object.", data: undefined };
        }
      }

      const res = await fetch(`/api/checker/test/${jobType}`, {
        method: "POST",
        headers: new Headers({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ url, body, method, headers, region }),
        signal: AbortSignal.timeout(ABORT_TIMEOUT),
      });

      if (!res.ok) {
        return {
          error: "Something went wrong. Please try again.",
        };
      }

      const as = assertions.deserialize(
        JSON.stringify([
          ...(statusAssertions || []),
          ...(headerAssertions || []),
          ...(textBodyAssertions || []),
        ]),
      );

      const data = (await res.json()) as RegionChecker;

      const _headers: Record<string, string> = {};
      // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
      res.headers.forEach((value, key) => (_headers[key] = value));

      if (as.length > 0) {
        for (const a of as) {
          const { success, message } = a.assert({
            body: data.body ?? "",
            header: data.headers ?? {},
            status: data.status,
          });
          if (!success) {
            return { data, error: `Assertion error: ${message}` };
          }
        }
      } else {
        // default assertion if no assertions are provided
        if (res.status < 200 || res.status >= 300) {
          return {
            data,
            error: `Assertion error: The response status was not 2XX: ${data.status}.`,
          };
        }
      }

      return { data, error: undefined };
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.name === "AbortError") {
        return {
          error: `Abort error: request takes more then ${formatDuration(
            ABORT_TIMEOUT,
          )}.`,
        };
      }
      return {
        error: "Something went wrong. Please try again.",
      };
    }
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
          <General {...{ form, tags }} />
          <Tabs
            defaultValue={defaultSection}
            className="w-full"
            onValueChange={onValueChange}
          >
            <TabsList>
              <TabsTrigger value="request">Request</TabsTrigger>
              <TabsTrigger value="scheduling">Scheduling & Regions</TabsTrigger>
              <TabsTrigger value="assertions">
                Timing & Assertions{" "}
                {_assertions.length ? (
                  <Badge variant="secondary" className="ml-1">
                    {_assertions.length}
                  </Badge>
                ) : null}
              </TabsTrigger>
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
              <TabsTrigger value="otel">OTel</TabsTrigger>
              {defaultValues?.id ? (
                <TabsTrigger value="danger">Danger</TabsTrigger>
              ) : null}
            </TabsList>
            <TabsContent value="request">
              <SectionRequests {...{ form, pingEndpoint, type }} />
            </TabsContent>
            <TabsContent value="assertions">
              <SectionAssertions {...{ form }} />
            </TabsContent>
            <TabsContent value="scheduling">
              <SectionScheduling {...{ form, limits, plan }} />
            </TabsContent>
            <TabsContent value="otel">
              <SectionOtel {...{ form, limits }} />
            </TabsContent>
            <TabsContent value="notifications">
              <SectionNotifications {...{ form, notifications }} />
            </TabsContent>
            <TabsContent value="status-page">
              <SectionStatusPage {...{ form, pages }} />
            </TabsContent>
            {defaultValues?.id ? (
              <TabsContent value="danger">
                <SectionDanger monitorId={defaultValues.id} {...{ form }} />
              </TabsContent>
            ) : null}
          </Tabs>
          <div className="grid gap-4 sm:flex sm:items-start sm:justify-end">
            {withTestButton ? (
              <RequestTestButton {...{ form, limits, pingEndpoint }} />
            ) : null}
            <SaveButton
              isPending={isPending}
              isDirty={form.formState.isDirty}
              onSubmit={form.handleSubmit(onSubmit)}
            />
          </div>
        </form>
      </Form>
      <FailedPingAlertConfirmation
        monitor={form.getValues()}
        {...{ pingFailed, setPingFailed }}
        onConfirm={handleForceDataUpdateOrInsertion}
      />
    </>
  );
}
