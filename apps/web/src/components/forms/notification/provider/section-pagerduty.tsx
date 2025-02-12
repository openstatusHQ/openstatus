"use client";

import type { UseFormReturn } from "react-hook-form";

import { LoadingAnimation } from "@/components/loading-animation";
import { toastAction } from "@/lib/toast";
import {
  type InsertNotificationWithData,
  InsertNotificationWithDataSchema,
  NotificationDataSchema,
  type WorkspacePlan,
  selectNotificationSchema,
} from "@openstatus/db/src/schema";
import { PagerDutySchema } from "@openstatus/notification-pagerduty";
import { Button } from "@openstatus/ui";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { sendPagerDutyTestAlert } from "./actions";

interface Props {
  form: UseFormReturn<InsertNotificationWithData>;
  plan: WorkspacePlan;
}

export function SectionPagerDuty({ form }: Props) {
  const [isTestPending, startTestTransition] = useTransition();
  const searchParams = useSearchParams();

  const config = searchParams.get("config") || form.getValues("data.pagerduty");

  const result = PagerDutySchema.safeParse(JSON.parse(config || ""));

  if (result.success === false) {
    return null;
  }

  const data = result.data;

  if (config) {
    form.setValue("data.pagerduty", config);
  }

  async function sendTestAlert() {
    startTestTransition(async () => {
      const isSuccessfull = await sendPagerDutyTestAlert(
        data.integration_keys[0].integration_key,
      );
      if (isSuccessfull) {
        toastAction("test-success");
      } else {
        toastAction("test-error");
      }
    });
  }

  return (
    <div className="col-span-full text-right">
      <Button
        type="button"
        variant="secondary"
        className="w-full sm:w-auto"
        onClick={sendTestAlert}
      >
        {!isTestPending ? "Test Alert" : <LoadingAnimation variant="inverse" />}
      </Button>
    </div>
  );
}
