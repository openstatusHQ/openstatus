"use client";

import { toastAction } from "@/lib/toast";
import type { UseFormReturn } from "react-hook-form";

import { LoadingAnimation } from "@/components/loading-animation";
import type { InsertNotificationWithData } from "@openstatus/db/src/schema";
import {
  Button,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@openstatus/ui";
import { useTransition } from "react";
import { sendNtfyTestAlert, sendWebhookTestAlert } from "./actions";

interface Props {
  form: UseFormReturn<InsertNotificationWithData>;
}

export function SectionWebhook({ form }: Props) {
  const [isTestPending, startTestTransition] = useTransition();

  const watchUrl = form.watch("data.webhook.endpoint");
  const watchToken = form.watch("data.webhook.headers");

  async function sendTestAlert() {
    if (!watchUrl) return;
    startTestTransition(async () => {
      const isSuccessfull = await sendWebhookTestAlert({
        url: watchUrl,
      });
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
        name="data.webhook.endpoint"
        render={({ field }) => (
          <FormItem className="sm:col-span-full">
            <FormLabel>URL</FormLabel>
            <FormControl>
              <Input
                type="url"
                placeholder="https://your-webhook-url"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {/* <FormField
        control={form.control}
        name="data.ntfy.token"
        render={({ field }) => (
          <FormItem className="sm:col-span-full">
            <FormLabel>Bearer Token</FormLabel>
            <FormControl>
              <Input type="url" placeholder="tk_iloveopenstatus" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      /> */}
      <div className="col-span-full text-right">
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto"
          disabled={isTestPending}
          onClick={sendTestAlert}
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
