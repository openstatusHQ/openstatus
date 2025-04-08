"use client";

import type { UseFormReturn } from "react-hook-form";

import type {
  InsertNotificationWithData,
  WorkspacePlan,
} from "@openstatus/db/src/schema";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@openstatus/ui";

import { SectionHeader } from "../shared/section-header";
import { SectionDiscord } from "./provider/section-discord";
import { SectionEmail } from "./provider/section-email";
import { SectionNtfy } from "./provider/section-ntfy";
import { SectionOpsGenie } from "./provider/section-opsgenie";
import { SectionPagerDuty } from "./provider/section-pagerduty";
import { SectionSlack } from "./provider/section-slack";
import { SectionSms } from "./provider/section-sms";
import { SectionWebhook } from "./provider/section-webhook";

const LABELS = {
  slack: "Slack",
  discord: "Discord",
  sms: "SMS",
  pagerduty: "PagerDuty",
  opsgenie: "OpsGenie",
  email: "Email",
  ntfy: "Ntfy.sh",
  webhook: "Webhook",
};

interface Props {
  form: UseFormReturn<InsertNotificationWithData>;
  plan: WorkspacePlan;
}

export function General({ form, plan }: Props) {
  const watchProvider = form.watch("provider");

  function renderProviderSection() {
    switch (watchProvider) {
      case "slack":
        return <SectionSlack form={form} />;
      case "discord":
        return <SectionDiscord form={form} />;
      case "sms":
        return <SectionSms form={form} />;
      case "pagerduty":
        return <SectionPagerDuty form={form} plan={plan} />;
      case "opsgenie":
        return <SectionOpsGenie form={form} plan={plan} />;
      case "email":
        return <SectionEmail form={form} />;
      case "ntfy":
        return <SectionNtfy form={form} />;
      case "webhook":
        return <SectionWebhook form={form} />;
      default:
        return <div>No provider selected</div>;
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
      <SectionHeader
        title="Alert"
        description={`Update your ${LABELS[watchProvider]} settings`}
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
        {renderProviderSection()}
      </div>
    </div>
  );
}
