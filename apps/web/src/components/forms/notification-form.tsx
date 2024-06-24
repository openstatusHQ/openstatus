"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { useForm } from "react-hook-form";

import type {
  InsertNotification,
  NotificationProvider,
  WorkspacePlan,
} from "@openstatus/db/src/schema";
import { insertNotificationSchema } from "@openstatus/db/src/schema";
import { sendTestDiscordMessage } from "@openstatus/notification-discord";
import { sendTestSlackMessage } from "@openstatus/notification-slack";
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

import { LoadingAnimation } from "@/components/loading-animation";
import { toastAction } from "@/lib/toast";
import { toCapitalize } from "@/lib/utils";
import { api } from "@/trpc/client";

function getDefaultProviderData(defaultValues?: InsertNotification) {
  if (!defaultValues?.provider) return ""; // FIXME: input can empty - needs to be undefined
  return JSON.parse(defaultValues?.data || "{}")[defaultValues?.provider];
}

function setProviderData(provider: NotificationProvider, data: string) {
  return { [provider]: data };
}

function getProviderMetaData(provider: NotificationProvider) {
  switch (provider) {
    case "email":
      return {
        dataType: "email",
        placeholder: "dev@documenso.com",
        setupDocLink: null,
        sendTest: null,
        plans: ["free", "starter", "pro", "team"],
      };

    case "slack":
      return {
        dataType: "url",
        placeholder: "https://hooks.slack.com/services/xxx...",
        setupDocLink:
          "https://api.slack.com/messaging/webhooks#getting_started",
        sendTest: sendTestSlackMessage,
        plans: ["free", "starter", "pro", "team"],
      };

    case "discord":
      return {
        dataType: "url",
        placeholder: "https://discord.com/api/webhooks/{channelId}/xxx...",
        setupDocLink: "https://support.discord.com/hc/en-us/articles/228383668",
        sendTest: sendTestDiscordMessage,
        plans: ["free", "starter", "pro", "team"],
      };
    case "sms":
      return {
        dataType: "tel",
        placeholder: "+123456789",
        setupDocLink: null,
        sendTest: null,
        plans: ["pro", "team"],
      };
    case "pagerduty":
      return {
        dataType: null,
        placeholder: "",
        setupDocLink:
          "https://docs.openstatus.dev/synthetic/features/notification/pagerduty",
        sendTest: null,
        plans: ["starter", "pro", "team"],
      };

    default:
      return {
        dataType: "url",
        placeholder: "xxxx",
        setupDocLink: `https://docs.openstatus.dev/integrations/${provider}`,
        send: null,
        plans: ["free", "starter", "pro", "team"],
      };
  }
}

interface Props {
  defaultValues?: InsertNotification;
  onSubmit?: () => void;
  workspacePlan: WorkspacePlan;
  nextUrl?: string;
  provider: NotificationProvider;
  d?: string;
}

export function NotificationForm({
  defaultValues,
  onSubmit: onExternalSubmit,
  workspacePlan,
  nextUrl,
  provider,
  d,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [isTestPending, startTestTransition] = useTransition();
  const router = useRouter();
  const form = useForm<InsertNotification>({
    resolver: zodResolver(insertNotificationSchema),
    defaultValues: {
      ...defaultValues,
      provider,
      name: defaultValues?.name || "",
      data: getDefaultProviderData(defaultValues),
    },
  });
  const watchWebhookUrl = form.watch("data");
  const providerMetaData = getProviderMetaData(provider);
  console.log(d);

  async function onSubmit({ provider, data, ...rest }: InsertNotification) {
    startTransition(async () => {
      try {
        if (provider === "pagerduty") {
          if (d) {
            data = d;
          }
        }
        if (data === "") {
          form.setError("data", { message: "This field is required" });
          return;
        }
        if (defaultValues) {
          await api.notification.update.mutate({
            provider,
            data: JSON.stringify(setProviderData(provider, data)),
            ...rest,
          });
        } else {
          await api.notification.create.mutate({
            provider,
            data: JSON.stringify(setProviderData(provider, data)),
            ...rest,
          });
        }
        if (nextUrl) {
          router.push(nextUrl);
        }
        router.refresh();
        toastAction("saved");
      } catch {
        toastAction("error");
      } finally {
        onExternalSubmit?.();
      }
    });
  }

  async function sendTestWebhookPing() {
    const webhookUrl = form.getValues("data");
    if (!webhookUrl) return;
    startTestTransition(async () => {
      const isSuccessfull = await providerMetaData.sendTest?.(webhookUrl);
      if (isSuccessfull) {
        toastAction("test-success");
      } else {
        toastAction("test-error");
      }
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, (errors) => {
          console.log(errors);
        })}
        className="grid w-full gap-6"
        id="notification-form" // we use a form id to connect the submit button to the form (as we also have the form nested inside of `MonitorForm`)
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="my-1.5 flex flex-col gap-2">
            <p className="font-semibold text-sm leading-none">Alerts</p>
            <p className="text-muted-foreground text-sm">
              Select the notification channels you want to be informed.
            </p>
          </div>
          <div className="grid gap-6 sm:col-span-2 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="sm:col-span-1 sm:self-baseline">
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Dev Team" {...field} />
                  </FormControl>
                  <FormDescription>
                    Define a name for the channel.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {providerMetaData.dataType && (
              <FormField
                control={form.control}
                name="data"
                render={({ field }) => (
                  <FormItem className="sm:col-span-full">
                    {/* make the first letter capital */}
                    <div className="flex items-center justify-between">
                      <FormLabel>{toCapitalize(provider)}</FormLabel>
                    </div>
                    <FormControl>
                      <Input
                        type={providerMetaData.dataType}
                        placeholder={providerMetaData.placeholder}
                        {...field}
                        disabled={
                          !providerMetaData.plans?.includes(workspacePlan)
                        }
                      />
                    </FormControl>
                    <FormDescription className="flex items-center justify-between">
                      The data required.
                      {providerMetaData.setupDocLink && (
                        <a
                          href={providerMetaData.setupDocLink}
                          target="_blank"
                          className="underline hover:no-underline"
                          rel="noreferrer"
                        >
                          How to setup your {toCapitalize(provider)} webhook
                        </a>
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        </div>
        <div className="flex gap-4 sm:justify-end">
          {providerMetaData.sendTest && (
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              size="lg"
              disabled={!watchWebhookUrl || isTestPending}
              onClick={sendTestWebhookPing}
            >
              {!isTestPending ? (
                "Test Webhook"
              ) : (
                <LoadingAnimation variant="inverse" />
              )}
            </Button>
          )}
          <Button
            form="notification-form"
            className="w-full sm:w-auto"
            size="lg"
            disabled={isPending}
          >
            {!isPending ? "Confirm" : <LoadingAnimation />}
          </Button>
        </div>
      </form>
    </Form>
  );
}
