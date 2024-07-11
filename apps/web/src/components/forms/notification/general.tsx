"use client";

import { useMemo, useTransition } from "react";
import type { UseFormReturn } from "react-hook-form";

import type {
  InsertNotification,
  WorkspacePlan,
} from "@openstatus/db/src/schema";
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

import { SectionHeader } from "../shared/section-header";
import { getProviderMetaData } from "./config";
import { toastAction } from "@/lib/toast";
import { LoadingAnimation } from "@/components/loading-animation";

interface Props {
  form: UseFormReturn<InsertNotification>;
  plan: WorkspacePlan;
}

export function General({ form, plan }: Props) {
  const [isTestPending, startTestTransition] = useTransition();
  const watchProvider = form.watch("provider");
  const watchWebhookUrl = form.watch("data");
  const providerMetaData = useMemo(
    () => getProviderMetaData(watchProvider),
    [watchProvider]
  );

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
    <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
      <SectionHeader
        title="Alert"
        description={`Update your ${providerMetaData.label} settings`}
      />
      <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="sm:col-span-1 sm:self-baseline">
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Dev Team" {...field} />
              </FormControl>
              <FormDescription>Define a name for the channel.</FormDescription>
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
                <FormLabel>{providerMetaData.label}</FormLabel>
                <FormControl>
                  <Input
                    type={providerMetaData.dataType}
                    placeholder={providerMetaData.placeholder}
                    {...field}
                    disabled={!providerMetaData.plans?.includes(plan)}
                  />
                </FormControl>
                <FormDescription className="flex items-center justify-between">
                  The data is required.
                  {providerMetaData.setupDocLink && (
                    <a
                      href={providerMetaData.setupDocLink}
                      target="_blank"
                      className="underline hover:no-underline"
                      rel="noreferrer"
                    >
                      How to setup your {providerMetaData.label} webhook
                    </a>
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <div className="col-span-full text-right">
          {providerMetaData.sendTest && (
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
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
        </div>
      </div>
    </div>
  );
}
