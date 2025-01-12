"use client";

import type { UseFormReturn } from "react-hook-form";

import { LoadingAnimation } from "@/components/loading-animation";
import { toastAction } from "@/lib/toast";
import type {
  InsertNotificationWithData,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui";
import { useTransition } from "react";

import { sendOpsGenieTestAlert } from "./actions";

interface Props {
  form: UseFormReturn<InsertNotificationWithData>;
  plan: WorkspacePlan;
}

export function SectionOpsGenie({ form, plan }: Props) {
  const [isTestPending, startTestTransition] = useTransition();
  const watchApiKey = form.watch("data.opsgenie.apiKey");
  const watchRegion = form.watch("data.opsgenie.region");

  async function sendTestAlert() {
    if (!watchApiKey || !watchRegion) return;
    startTestTransition(async () => {
      const isSuccessfull = await sendOpsGenieTestAlert(
        watchApiKey,
        watchRegion,
      );
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
        name="data.opsgenie.apiKey"
        render={({ field }) => (
          <FormItem className="sm:col-span-full">
            <FormLabel>API Key</FormLabel>
            <FormControl>
              <Input placeholder={"xxx-yyy-zzz"} {...field} />
            </FormControl>
            <FormDescription className="flex items-center justify-between">
              The API key is required.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="data.opsgenie.region"
        render={({ field }) => (
          <FormItem className="sm:col-span-full">
            <FormLabel>Region</FormLabel>
            <FormControl>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a region" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="us">US</SelectItem>
                  <SelectItem value="eu">EU</SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            <FormDescription className="flex items-center justify-between">
              The region is required.
              <a
                href="https://docs.openstatus.dev/synthetic/features/notification/opsgenie"
                target="_blank"
                className="underline hover:no-underline"
                rel="noreferrer"
              >
                How to setup your OpsGenie.
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
          disabled={isTestPending || !watchApiKey || !watchRegion}
          onClick={sendTestAlert}
        >
          {!isTestPending ? (
            "Test Alert"
          ) : (
            <LoadingAnimation variant="inverse" />
          )}
        </Button>
      </div>
    </>
  );
}
