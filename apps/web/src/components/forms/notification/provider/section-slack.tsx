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
import { sendTestSlackMessage } from "@openstatus/notification-slack";

interface Props {
  form: UseFormReturn<InsertNotificationWithData>;
}

export function SectionSlack({ form }: Props) {
  const [isTestPending, startTestTransition] = useTransition();
  const watchUrl = form.watch("data.slack");

  async function sendTestWebhookPing() {
    if (!watchUrl) return;
    startTestTransition(async () => {
      const isSuccessfull = await sendTestSlackMessage(watchUrl);
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
        name="data.slack"
        render={({ field }) => (
          <FormItem className="sm:col-span-full">
            <FormLabel>Webhook URL</FormLabel>
            <FormControl>
              <Input
                type="url"
                placeholder="https://hooks.slack.com/services/xxx..."
                required
                {...field}
              />
            </FormControl>
            <FormDescription className="flex items-center justify-between">
              The data is required.
              <a
                href={
                  "https://api.slack.com/messaging/webhooks#getting_started"
                }
                target="_blank"
                className="underline hover:no-underline"
                rel="noreferrer"
              >
                How to setup your Slack webhook
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
