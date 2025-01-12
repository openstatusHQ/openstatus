"use client";

import type { UseFormReturn } from "react-hook-form";

import {
  type InsertNotificationWithData,
  InsertNotificationWithDataSchema,
  NotificationDataSchema,
  selectNotificationSchema,
  type WorkspacePlan,
} from "@openstatus/db/src/schema";
import { Button } from "@openstatus/ui";
import { LoadingAnimation } from "@/components/loading-animation";
import { useTransition } from "react";
import { toastAction } from "@/lib/toast";
import { PagerDutySchema } from "@openstatus/notification-pagerduty";
import { useSearchParams } from "next/navigation";
import { sendPagerDutyTestAlert } from "./actions";

interface Props {
  form: UseFormReturn<InsertNotificationWithData>;
  plan: WorkspacePlan;
}

export function SectionPagerDuty({ form }: Props) {
  const [isTestPending, startTestTransition] = useTransition();
  const searchParams = useSearchParams();

  const config = searchParams.get("config");

  const result = PagerDutySchema.safeParse(JSON.parse(config || ""));
  // We should fix that but that's not working for editing pagerduty notifications
  if (result.success === false) {
    return null;
  }

  const data = result.data;

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
