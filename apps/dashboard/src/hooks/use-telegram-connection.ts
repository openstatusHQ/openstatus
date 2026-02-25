"use client";

import type { FormValues } from "@/components/forms/notifications/form-telegram";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import React, { useReducer, useTransition } from "react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

interface UseTelegramConnectionProps {
  form: UseFormReturn<FormValues>;
  mode: "qr" | "manual" | null;
}

interface TelegramConnectionState {
  flowStep: "private" | "group";
  privateChatId: string | null;
  userName: string | null;
  groupTitle: string | null;
  sessionStartTime: number | null;
}

type TelegramConnectionAction =
  | { type: "SET_SESSION_START_TIME"; payload: number | null }
  | { type: "RESET_STATE" }
  | { type: "RESET_GROUP_CONNECTION" }
  | {
      type: "SET_PRIVATE_CONNECTION_DATA";
      payload: {
        privateChatId: string;
        userName: string;
      };
    }
  | {
      type: "SET_GROUP_CONNECTION_DATA";
      payload: {
        groupTitle: string;
        chatId: string;
      };
    };

const initialState: TelegramConnectionState = {
  flowStep: "private",
  privateChatId: null,
  userName: null,
  groupTitle: null,
  sessionStartTime: null,
};

function telegramConnectionReducer(
  state: TelegramConnectionState,
  action: TelegramConnectionAction,
): TelegramConnectionState {
  switch (action.type) {
    case "SET_SESSION_START_TIME":
      return { ...state, sessionStartTime: action.payload };
    case "RESET_STATE":
      return initialState;
    case "RESET_GROUP_CONNECTION":
      return {
        ...state,
        groupTitle: null,
        sessionStartTime: Math.floor(Date.now() / 1000),
        flowStep: state.privateChatId ? "group" : "private",
      };
    case "SET_PRIVATE_CONNECTION_DATA":
      return {
        ...state,
        privateChatId: action.payload.privateChatId,
        userName: action.payload.userName,
        flowStep: "group",
      };
    case "SET_GROUP_CONNECTION_DATA":
      return {
        ...state,
        groupTitle: action.payload.groupTitle,
      };
    default:
      return state;
  }
}

export function useTelegramConnection({
  form,
  mode,
}: UseTelegramConnectionProps) {
  const [isPending, startTransition] = useTransition();
  const trpc = useTRPC();
  const [state, dispatch] = useReducer(telegramConnectionReducer, initialState);

  // Create Telegram Token
  const { data: tokenData, isLoading: isTokenLoading } = useQuery({
    ...trpc.notification.createTelegramToken.queryOptions(),
    refetchOnWindowFocus: false,
  });

  // Set session start time when entering QR mode
  React.useEffect(() => {
    if (mode === "qr") {
      dispatch({
        type: "SET_SESSION_START_TIME",
        payload: Math.floor(Date.now() / 1000),
      });
    } else if (mode === null) {
      dispatch({ type: "SET_SESSION_START_TIME", payload: null });
    }
  }, [mode]);

  // Cleanup: Reset UI state when component unmounts (e.g., on discard)
  React.useEffect(() => {
    return () => {
      // This runs when component unmounts
      dispatch({ type: "RESET_STATE" });
    };
  }, []);

  // Start polling for updates
  const { data: updates } = useQuery({
    ...trpc.notification.getTelegramUpdates.queryOptions({
      privateChatId:
        state.flowStep === "group"
          ? state.privateChatId ?? undefined
          : undefined,
      since: state.sessionStartTime ?? undefined,
    }),
    enabled:
      !!tokenData?.token && !form.getValues("data.chatId") && mode === "qr",
    refetchInterval: 5000,
  });

  React.useEffect(() => {
    if (updates && updates.length > 0) {
      const lastUpdate = updates[updates.length - 1];

      // Phase 1: Private chat ID received
      if (lastUpdate.chatType === "private" && state.flowStep === "private") {
        dispatch({
          type: "SET_PRIVATE_CONNECTION_DATA",
          payload: {
            privateChatId: lastUpdate.chatId,
            userName: lastUpdate.user?.first_name || "Unknown",
          },
        });
        toast.success(
          `Connected to ${lastUpdate.user?.first_name || "Unknown"}'s account. Now add the bot to your group.`,
        );
      }
      // Phase 2: Group chat ID received
      else if (lastUpdate.chatType === "group" && state.flowStep === "group") {
        dispatch({
          type: "SET_GROUP_CONNECTION_DATA",
          payload: {
            groupTitle: lastUpdate.chatTitle || "Unknown",
            chatId: lastUpdate.chatId,
          },
        });
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
  }, [updates, form, state.flowStep]);

  const resetConnection = React.useCallback(() => {
    form.setValue("data.chatId", "", { shouldDirty: true });
    dispatch({ type: "RESET_GROUP_CONNECTION" });
  }, [form]);

  const confirmPrivateChat = React.useCallback(() => {
    if (state.privateChatId) {
      startTransition(() => {
        form.setValue("data.chatId", state.privateChatId ?? "", {
          shouldDirty: true,
        });
        toast.success(
          `Connected to ${state.userName || "Unknown"}'s private chat`,
        );
      });
    }
  }, [form, state.privateChatId, state.userName]);

  return {
    tokenData,
    isTokenLoading,
    flowStep: state.flowStep,
    privateChatId: state.privateChatId,
    userName: state.userName,
    groupTitle: state.groupTitle,
    isPolling:
      !!tokenData?.token && !form.watch("data.chatId") && mode === "qr",
    resetConnection,
    confirmPrivateChat,
    isPending,
  };
}
