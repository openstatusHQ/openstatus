"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type { Notification } from "@openstatus/db/src/schema";
import {
  insertNotificationSchema,
  providerEnum,
  providerName,
} from "@openstatus/db/src/schema";
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

/**
 * TODO: based on the providers `data` structure, create dynamic form inputs
 * e.g. Provider: Email will need an `email` input field and
 * we store it like `data: { email: "" }`
 * But Provider: Slack will maybe require `webhook` and `channel` and
 * we store it like `data: { webhook: "", channel: "" }`
 */

const AVAILABLE_PROVIDERS = ["slack", "email"];
type ProviderType = "email" | "discord" | "slack";

function getDefaultProviderData(defaultValues?: Notification) {
  if (!defaultValues?.provider) {
    return "";
  }

  return JSON.parse(defaultValues?.data || "{}")[defaultValues?.provider];
}

function setProviderData(provider: ProviderType, data: string) {
  if (!provider) {
    return {};
  }

  return { [provider]: data };
}

function getProviderMetaData(provider: ProviderType) {
  switch (provider) {
    case "email":
      return {
        dataType: "email",
        placeholder: "dev@documenso.com",
        setupDocLink: null,
        testNeeded: false,
      };

    case "slack":
      return {
        dataType: "url",
        placeholder: "https://hooks.slack.com/services/xxx...",
        setupDocLink:
          "https://api.slack.com/messaging/webhooks#getting_started",
        testNeeded: true,
      };

    default:
      return {
        dataType: "url",
        placeholder: "xxxx",
        setupDocLink: `https://docs.openstatus.dev/integrations/${provider}`,
        testNeeded: false,
      };
  }
}

interface Props {
  defaultValues?: Notification;
  workspaceSlug: string;
  onSubmit?: () => void;
}

export function NotificationForm({
  workspaceSlug,
  defaultValues,
  onSubmit: onExternalSubmit,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [isTestPending, startTestTransition] = useTransition();
  const { toast } = useToastAction();
  const router = useRouter();
  const form = useForm<Notification>({
    resolver: zodResolver(insertNotificationSchema),
    defaultValues: {
      ...defaultValues,
      data: getDefaultProviderData(defaultValues),
    },
  });

  const watchProvider = form.watch("provider");
  const watchWebhookUrl = form.watch("data");
  const providerMetaData = useMemo(
    () => getProviderMetaData(watchProvider),
    [watchProvider],
  );

  async function onSubmit({ provider, data, ...rest }: Notification) {
    startTransition(async () => {
      try {
        if (defaultValues) {
          await api.notification.updateNotification.mutate({
            provider,
            data: JSON.stringify(setProviderData(provider, data)),
            ...rest,
          });
        } else {
          await api.notification.createNotification.mutate({
            workspaceSlug,
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

  async function sendTestWebhookPing(provider: ProviderType) {
    const webhookUrl = form.getValues("data");
    if (!webhookUrl) {
      return;
    }
    startTestTransition(async () => {
      let isSuccessful = null;
      switch (provider) {
        case "slack":
          isSuccessful = await sendTestSlackMessage(webhookUrl);
          break;

        default:
          break;
      }

      if (isSuccessful) {
        toast("success");
        return;
      }
      toast("test-error");
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
                      field.onChange(providerEnum.parse(value))
                    }
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="capitalize">
                        <SelectValue placeholder="Select Provider" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {providerName.map((provider) => (
                        <SelectItem
                          key={provider}
                          value={provider}
                          disabled={!AVAILABLE_PROVIDERS.includes(provider)} // only allow email for now
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
                        <span>
                          <a
                            href={providerMetaData.setupDocLink}
                            target="_blank"
                            className="underline"
                          >
                            How to setup your {toCapitalize(watchProvider)}{" "}
                            webhook
                          </a>
                        </span>
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
          {providerMetaData.testNeeded && (
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              size="lg"
              disabled={!watchWebhookUrl}
              onClick={() => sendTestWebhookPing(watchProvider)}
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
