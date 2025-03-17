"use client";

import { toastAction } from "@/lib/toast";
import type { UseFormReturn } from "react-hook-form";

import { LoadingAnimation } from "@/components/loading-animation";
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
import { useTransition } from "react";
import { sendNtfyTestAlert } from "./actions";

interface Props {
  form: UseFormReturn<InsertNotificationWithData>;
}

export function SectionNtfy({ form }: Props) {
  const [isTestPending, startTestTransition] = useTransition();

  const watchTopic = form.watch("data.ntfy.topic");
  const watchUrl = form.watch("data.ntfy.serverUrl");
  const watchToken = form.watch("data.ntfy.token");

  async function sendTestAlert() {
    if (!watchTopic) return;
    startTestTransition(async () => {
      const isSuccessfull = await sendNtfyTestAlert({
        topic: watchTopic,
        serverUrl: watchUrl || undefined,
        token: watchToken || undefined,
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
        name="data.ntfy.topic"
        render={({ field }) => (
          <FormItem className="sm:col-span-full">
            <FormLabel>Topic</FormLabel>
            <FormControl>
              <Input type="text" placeholder="your-topic" required {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="data.ntfy.serverUrl"
        render={({ field }) => (
          <FormItem className="sm:col-span-full">
            <FormLabel>URL</FormLabel>
            <FormControl>
              <Input type="url" placeholder="https://ntfy.sh" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
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
      />
      <div className="col-span-full text-right">
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto"
          disabled={isTestPending || !watchTopic}
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
