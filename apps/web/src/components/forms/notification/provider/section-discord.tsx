"use client";

import { useTransition } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { InsertNotificationWithData } from "@openstatus/db/src/schema";
import {
  Button,
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
import { sendTestDiscordMessage } from "@openstatus/notification-discord";

interface Props {
  form: UseFormReturn<InsertNotificationWithData>;
}

export function SectionDiscord({ form }: Props) {
  const [isTestPending, startTestTransition] = useTransition();
  const watchUrl = form.watch("data.discord");

  async function sendTestWebhookPing() {
    if (!watchUrl) return;
    startTestTransition(async () => {
      const isSuccessfull = await sendTestDiscordMessage(watchUrl);
      if (isSuccessfull) {
        toastAction("test-success");
      } else {
        toastAction("test-error");
      }
    });
  }

  return (
    <>
      <FormField
        control={form.control}
        name="data.discord"
        render={({ field }) => (
          <FormItem className="sm:col-span-full">
            <FormLabel>Webhook URL</FormLabel>
            <FormControl>
              <Input
                type="url"
                placeholder="https://discord.com/api/webhooks/{channelId}/xxx..."
                required
                {...field}
              />
            </FormControl>
            <FormDescription className="flex items-center justify-between">
              The data is required.
              <a
                href={"https://support.discord.com/hc/en-us/articles/228383668"}
                target="_blank"
                className="underline hover:no-underline"
                rel="noreferrer"
              >
                How to setup your Discord webhook
              </a>
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="col-span-full text-right">
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto"
          disabled={isTestPending || !watchUrl}
          onClick={sendTestWebhookPing}
        >
          {!isTestPending ? (
            "Test Webhook"
          ) : (
            <LoadingAnimation variant="inverse" />
          )}
        </Button>
      </div>
    </>
  );
}
