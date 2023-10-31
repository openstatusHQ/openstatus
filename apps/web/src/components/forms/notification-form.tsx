"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type {
  InsertNotification,
  NotificationProvider,
} from "@openstatus/db/src/schema";
import {
  insertNotificationSchema,
  notificationProvider,
  notificationProviderSchema,
} from "@openstatus/db/src/schema";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui";

import { LoadingAnimation } from "@/components/loading-animation";
import { useToastAction } from "@/hooks/use-toast-action";
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
      };

    case "slack":
      return {
        dataType: "url",
        placeholder: "https://hooks.slack.com/services/xxx...",
        setupDocLink:
          "https://api.slack.com/messaging/webhooks#getting_started",
        sendTest: sendTestSlackMessage,
      };

    case "discord":
      return {
        dataType: "url",
        placeholder: "https://hooks.slack.com/services/xxx...", // FIXME:
        setupDocLink:
          "https://api.slack.com/messaging/webhooks#getting_started", // FIXME:
        sendTest: sendTestDiscordMessage,
      };

    default:
      return {
        dataType: "url",
        placeholder: "xxxx",
        setupDocLink: `https://docs.openstatus.dev/integrations/${provider}`,
        send: null,
      };
  }
}

interface Props {
  defaultValues?: InsertNotification;
  onSubmit?: () => void;
}

export function NotificationForm({
  defaultValues,
  onSubmit: onExternalSubmit,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [isTestPending, startTestTransition] = useTransition();
  const { toast } = useToastAction();
  const router = useRouter();
  const form = useForm<InsertNotification>({
    resolver: zodResolver(insertNotificationSchema),
    defaultValues: {
      ...defaultValues,
      name: defaultValues?.name || "",
      data: getDefaultProviderData(defaultValues),
    },
  });
  const watchProvider = form.watch("provider");
  const watchWebhookUrl = form.watch("data");
  const providerMetaData = useMemo(
    () => getProviderMetaData(watchProvider),
    [watchProvider],
  );

  async function onSubmit({ provider, data, ...rest }: InsertNotification) {
    startTransition(async () => {
      try {
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
        router.refresh();
        toast("saved");
      } catch {
        toast("error");
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
        toast("test-success");
      } else {
        toast("test-error");
      }
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid w-full gap-6"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="my-1.5 flex flex-col gap-2">
            <p className="text-sm font-semibold leading-none">Alerts</p>
            <p className="text-muted-foreground text-sm">
              Select the notification channels you want to be informed.
            </p>
          </div>
          <div className="grid gap-6 sm:col-span-2 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="provider"
              render={({ field }) => (
                <FormItem className="sm:col-span-1 sm:self-baseline">
                  <FormLabel>Provider</FormLabel>
                  <Select
                    onValueChange={(value) =>
                      field.onChange(notificationProviderSchema.parse(value))
                    }
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="capitalize">
                        <SelectValue placeholder="Select Provider" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {notificationProvider.map((provider) => (
                        <SelectItem
                          key={provider}
                          value={provider}
                          className="capitalize"
                        >
                          {provider}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    What channel/provider to send a notification.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
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
            {watchProvider && (
              <FormField
                control={form.control}
                name="data"
                render={({ field }) => (
                  <FormItem className="sm:col-span-full">
                    {/* make the first letter capital */}
                    <div className="flex items-center justify-between">
                      <FormLabel>{toCapitalize(watchProvider)}</FormLabel>
                    </div>
                    <FormControl>
                      <Input
                        type={providerMetaData.dataType}
                        placeholder={providerMetaData.placeholder}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="flex items-center justify-between">
                      The data required.
                      {providerMetaData.setupDocLink && (
                        <a
                          href={providerMetaData.setupDocLink}
                          target="_blank"
                          className="underline hover:no-underline"
                        >
                          How to setup your {toCapitalize(watchProvider)}{" "}
                          webhook
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
          <Button className="w-full sm:w-auto" size="lg" disabled={isPending}>
            {!isPending ? "Confirm" : <LoadingAnimation />}
          </Button>
        </div>
      </form>
    </Form>
  );
}
