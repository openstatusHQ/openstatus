"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import React, { useTransition } from "react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

interface UseTelegramConnectionProps {
  form: UseFormReturn<any>;
  mode: "qr" | "manual" | null;
}

export function useTelegramConnection({
  form,
  mode,
}: UseTelegramConnectionProps) {
  const [isPending, startTransition] = useTransition();
  const trpc = useTRPC();

  // Create Telegram Token
  const { data: tokenData, isLoading: isTokenLoading } = useQuery({
    ...trpc.notification.createTelegramToken.queryOptions(),
    refetchOnWindowFocus: false,
  });

  const [flowStep, setFlowStep] = React.useState<"private" | "group">(
    "private",
  );
  const [privateChatId, setPrivateChatId] = React.useState<string | null>(null);
  const [userName, setUserName] = React.useState<string | null>(null);
  const [groupTitle, setGroupTitle] = React.useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = React.useState<number | null>(
    null,
  );

  // Set session start time when entering QR mode
  React.useEffect(() => {
    if (mode === "qr") {
      setSessionStartTime(Math.floor(Date.now() / 1000));
    } else if (mode === null) {
      setSessionStartTime(null);
    }
  }, [mode]);

  // Cleanup: Reset UI state when component unmounts (e.g., on discard)
  React.useEffect(() => {
    return () => {
      // This runs when component unmounts
      setFlowStep("private");
      setPrivateChatId(null);
      setUserName(null);
      setGroupTitle(null);
      setSessionStartTime(null);
    };
  }, []);

  // Start polling for updates
  const { data: updates } = useQuery({
    ...trpc.notification.getTelegramUpdates.queryOptions({
      privateChatId:
        flowStep === "group" ? privateChatId ?? undefined : undefined,
      since: sessionStartTime ?? undefined,
    }),
    enabled:
      !!tokenData?.token && !form.getValues("data.chatId") && mode === "qr",
    refetchInterval: 5000,
  });

  React.useEffect(() => {
    if (updates && updates.length > 0) {
      const lastUpdate = updates[updates.length - 1];

      // Phase 1: Private chat ID received
      if (lastUpdate.chatType === "private" && flowStep === "private") {
        setPrivateChatId(lastUpdate.chatId);
        setUserName(lastUpdate.user?.first_name || "Unknown");
        setFlowStep("group");
        toast.success(
          `Connected to ${lastUpdate.user?.first_name || "Unknown"}'s account. Now add the bot to your group.`,
        );
      }
      // Phase 2: Group chat ID received
      else if (lastUpdate.chatType === "group" && flowStep === "group") {
        setGroupTitle(lastUpdate.chatTitle || "Unknown");
        startTransition(() => {
          form.setValue("data.chatId", lastUpdate.chatId, {
            shouldDirty: true,
          });
          toast.success(
            `Connected to group "${lastUpdate.chatTitle || "Unknown"}"`,
          );
        });
      }
    }
  }, [updates, form, flowStep]);

  const resetConnection = React.useCallback(() => {
    // Only reset the group chat ID, keep privateChatId
    form.setValue("data.chatId", "", { shouldDirty: true });
    setGroupTitle(null);
    // Update session start time to listen for new group updates
    setSessionStartTime(Math.floor(Date.now() / 1000));
    // Keep flowStep as "group" since we already have privateChatId
    // This allows connecting to a new group with the same private chat
    if (privateChatId) {
      setFlowStep("group");
    } else {
      setFlowStep("private");
    }
  }, [form, privateChatId]);

  return {
    tokenData,
    isTokenLoading,
    flowStep,
    privateChatId,
    userName,
    groupTitle,
    isPolling:
      !!tokenData?.token && !form.watch("data.chatId") && mode === "qr",
    resetConnection,
    isPending,
  };
}
