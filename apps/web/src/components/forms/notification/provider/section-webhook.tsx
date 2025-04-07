"use client";

import { toastAction } from "@/lib/toast";
import { type UseFormReturn, useFieldArray } from "react-hook-form";

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
import { X } from "lucide-react";
import { useTransition } from "react";
import { sendWebhookTestAlert } from "./actions";

interface Props {
  form: UseFormReturn<InsertNotificationWithData>;
}

export function SectionWebhook({ form }: Props) {
  const [isTestPending, startTestTransition] = useTransition();

  const { fields, append,  remove } = useFieldArray({
    name: "data.webhook.headers",
    control: form.control,
  });

  const watchUrl = form.watch("data.webhook.endpoint");
  const watchHeaders = form.watch("data.webhook.headers");

  async function sendTestAlert() {
    if (!watchUrl) return;
    startTestTransition(async () => {
      const isSuccessful = await sendWebhookTestAlert({
        url: watchUrl,
        headers: watchHeaders,
      });
      if (isSuccessful) {
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

      <div className="space-y-2 sm:col-span-full">
        <FormLabel>Request Header</FormLabel>
        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-6 gap-4">
            <FormField
              control={form.control}
              name={`data.webhook.headers.${index}.key`}
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormControl>
                    <Input placeholder="key" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="col-span-4 flex items-center space-x-2">
              <FormField
                control={form.control}
                name={`data.webhook.headers.${index}.value`}
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormControl>
                      <Input placeholder="value" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <Button
                size="icon"
                variant="ghost"
                type="button"
                onClick={() => remove(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => append({ key: "", value: "" })}
          >
            Add Custom Header
          </Button>
        </div>
      </div>

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
