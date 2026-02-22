"use client";

import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useTransition } from "react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { FormValues } from "../notifications/form-telegram";

interface TelegramFormActionsProps {
  form: UseFormReturn<FormValues>;
  isPending: boolean;
}

export function TelegramFormActions({
  form,
  isPending,
}: TelegramFormActionsProps) {
  const [_, startTransition] = useTransition();
  const trpc = useTRPC();
  const sendTestMutation = useMutation(
    trpc.notification.sendTest.mutationOptions(),
  );

  function testAction() {
    if (isPending) return;

    startTransition(async () => {
      try {
        const provider = form.getValues("provider");
        const data = form.getValues("data");
        const promise = sendTestMutation.mutateAsync({
          provider,
          data: {
            telegram: { chatId: data.chatId },
          },
        });
        toast.promise(promise, {
          loading: "Sending test...",
          success: "Test sent",
          error: (error) => {
            if (isTRPCClientError(error)) {
              return error.message;
            }
            if (error instanceof Error) {
              return error.message;
            }
            return "Failed to send test";
          },
        });
        await promise;
      } catch (error) {
        console.error(error);
      }
    });
  }

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={testAction}
        disabled={isPending}
      >
        Send Test
      </Button>
    </div>
  );
}
