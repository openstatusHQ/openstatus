"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type {
  InsertNotification,
  WorkspacePlan,
} from "@openstatus/db/src/schema";
import { insertNotificationSchema } from "@openstatus/db/src/schema";
import { Button, Form } from "@openstatus/ui";

import { LoadingAnimation } from "@/components/loading-animation";
import { toastAction } from "@/lib/toast";
import { api } from "@/trpc/client";
import { SaveButton } from "../shared/save-button";
import {
  getDefaultProviderData,
  getProviderMetaData,
  setProviderData,
} from "./config";
import { General } from "./general";

interface Props {
  defaultValues?: InsertNotification;
  onSubmit?: () => void;
  workspacePlan: WorkspacePlan;
  nextUrl?: string;
}

export function NotificationForm({
  defaultValues,
  onSubmit: onExternalSubmit,
  workspacePlan,
  nextUrl,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [isTestPending, startTestTransition] = useTransition();
  const router = useRouter();
  const form = useForm<InsertNotification>({
    resolver: zodResolver(insertNotificationSchema),
    defaultValues: {
      ...defaultValues,
      name: defaultValues?.name || "",
      data: getDefaultProviderData(defaultValues),
    },
  });
  const watchProvider = form.watch("provider");
  const watchWebhookUrl = form.watch("data");
  const providerMetaData = useMemo(
    () => getProviderMetaData(watchProvider),
    [watchProvider],
  );

  async function onSubmit({ provider, data, ...rest }: InsertNotification) {
    startTransition(async () => {
      try {
        if (data === "") {
          form.setError("data", { message: "This field is required" });
          return;
        }
        if (defaultValues) {
          await api.notification.update.mutate({
            provider,
            data: JSON.stringify(setProviderData(provider, data)),
            ...rest,
          });
        } else {
          await api.notification.create.mutate({
            provider,
            data: JSON.stringify(setProviderData(provider, data)),
            ...rest,
          });
        }
        if (nextUrl) {
          router.push(nextUrl);
        }
        router.refresh();
        toastAction("saved");
      } catch {
        toastAction("error");
      } finally {
        onExternalSubmit?.();
      }
    });
  }

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
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        id="notification-form" // we use a form id to connect the submit button to the form (as we also have the form nested inside of `MonitorForm`)
        className="flex flex-col gap-4"
      >
        <General form={form} plan={workspacePlan} />
        <div className="flex gap-4 sm:justify-end">
          {providerMetaData.sendTest && (
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              size="lg"
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
          <SaveButton
            form="notification-form"
            isPending={isPending}
            isDirty={form.formState.isDirty}
            onSubmit={form.handleSubmit(onSubmit)}
          />
        </div>
      </form>
    </Form>
  );
}
