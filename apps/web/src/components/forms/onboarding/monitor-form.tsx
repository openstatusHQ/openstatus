"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";

import type { InsertMonitor } from "@openstatus/db/src/schema";
import { insertMonitorSchema } from "@openstatus/db/src/schema";
import {
  Button,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@openstatus/ui";

import { pingEndpoint } from "@/app/app/[workspaceSlug]/onboarding/utils";
import { LoadingAnimation } from "@/components/loading-animation";
import { FailedPingAlertConfirmation } from "@/components/modals/failed-ping-alert-confirmation";
import { toast, toastAction } from "@/lib/toast";
import { api } from "@/trpc/client";
import * as assertions from "@openstatus/assertions";
import type { Limits } from "@openstatus/db/src/schema/plan/schema";
import { getLimit } from "@openstatus/db/src/schema/plan/utils";

interface MonitorFormProps {
  defaultValues?: Partial<InsertMonitor>;
  limits: Limits;
  toStep: number;
}

export function MonitorForm({
  defaultValues,
  limits,
  toStep,
}: MonitorFormProps) {
  const _assertions = defaultValues?.assertions
    ? assertions.deserialize(defaultValues?.assertions).map((a) => a.schema)
    : [];

  const form = useForm<InsertMonitor>({
    resolver: zodResolver(insertMonitorSchema),
    defaultValues: {
      url: defaultValues?.url || "",
      name: defaultValues?.name || "placeholder", // NOTE: overwritten by the url
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
  const [isPending, setPending] = React.useState(false);
  const [pingFailed, setPingFailed] = React.useState(false);

  const handleDataUpdateOrInsertion = async (props: InsertMonitor) => {
    if (defaultValues) {
      await api.monitor.update.mutate({
        id: defaultValues.id,
        ...props,
      });
    } else {
      await api.monitor.create.mutate({
        ...props,
        name: props.url
          ?.replace(/^.*?:\/\//, "")
          .replace(/\.[^.]*$/, "")
          .replaceAll(/[.-]/g, " "),
      });
    }
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
        const { error } = await pingEndpoint({ url: props.url });
        if (error) {
          setPingFailed(true);
          throw new Error(error);
        }
        await handleDataUpdateOrInsertion(props);
        router.replace(`?step=${toStep}`);
        router.refresh();
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

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex w-full flex-col gap-4"
        >
          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://documenso.com" {...field} />
                </FormControl>
                <FormDescription>
                  Enter the URL to check or use the example URL:{" "}
                  <Button
                    type="button"
                    onClick={() => {
                      field.onChange("https://openstat.us/200");
                    }}
                    variant="outline"
                    size="sm"
                    className="px-2 h-7"
                  >
                    https://openstat.us/200
                  </Button>
                </FormDescription>
                {defaultValues ? (
                  <p className="text-sm text-destructive" role="alert">
                    You are updating an existing monitor with id:{" "}
                    <span className="font-mono">{defaultValues.id}</span>
                  </p>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />
          <div>
            <Button
              className="w-full sm:w-auto"
              size="lg"
              type="submit"
              disabled={isPending}
            >
              {!isPending ? (
                defaultValues ? (
                  "Update Monitor"
                ) : (
                  "Create Monitor"
                )
              ) : (
                <LoadingAnimation />
              )}
            </Button>
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
