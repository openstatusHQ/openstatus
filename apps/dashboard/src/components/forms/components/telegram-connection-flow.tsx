"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openstatus/ui/components/ui/tabs";
import type { UseFormReturn } from "react-hook-form";

import { useTelegramConnection } from "@/hooks/use-telegram-connection";

import type { FormValues } from "../notifications/form-telegram";
import { TelegramManualInput } from "./telegram-manual-input";
import { TelegramQRConnection } from "./telegram-qr-connection";

interface TelegramConnectionFlowProps {
  form: UseFormReturn<FormValues>;
  mode: "qr" | "manual" | null;
  onModeChange: (mode: "qr" | "manual" | null) => void;
  isSelfHosted?: boolean; // Optional: if not provided, assumes cloud (optimistic)
}

export function TelegramConnectionFlow({
  form,
  mode,
  onModeChange,
  isSelfHosted: isSelfHostedProp,
}: TelegramConnectionFlowProps) {
  const {
    tokenData,
    isTokenLoading,
    flowStep,
    privateChatId,
    userName,
    groupTitle,
    isPolling,
    resetConnection,
    confirmPrivateChat,
  } = useTelegramConnection({ form, mode });

  // Use prop if provided, otherwise use value from backend, default to false (cloud)
  const isSelfHosted = isSelfHostedProp ?? tokenData?.isSelfHosted ?? false;
  const redisAvailable = tokenData?.redisAvailable === true;

  // Biased loading behavior:
  // - Self-hosted: Hide QR during loading (conservative, prevents flash)
  // - Cloud: Show QR during loading (optimistic, better UX)
  // After loading: always check actual redisAvailable value
  if ((isSelfHosted && isTokenLoading) || (!isTokenLoading && !redisAvailable)) {
    return <TelegramManualInput form={form} />;
  }

  return (
    <Tabs
      value={mode ?? "qr"}
      onValueChange={(v) => onModeChange(v as "qr" | "manual")}
    >
      <TabsList className="w-full">
        <TabsTrigger value="qr" className="flex-1">
          Connect with QR
        </TabsTrigger>
        <TabsTrigger value="manual" className="flex-1">
          Enter ChatID manually
        </TabsTrigger>
      </TabsList>
      <TabsContent value="qr">
        <TelegramQRConnection
          form={form}
          token={tokenData?.token ?? undefined}
          isLoading={isTokenLoading}
          isPolling={isPolling}
          flowStep={flowStep}
          privateChatId={privateChatId}
          userName={userName}
          groupTitle={groupTitle}
          onReset={resetConnection}
          onConfirmPrivateChat={confirmPrivateChat}
        />
      </TabsContent>
      <TabsContent value="manual">
        <TelegramManualInput form={form} />
      </TabsContent>
    </Tabs>
  );
}
