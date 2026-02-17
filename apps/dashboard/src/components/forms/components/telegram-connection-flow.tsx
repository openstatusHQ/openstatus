"use client";

import { useTelegramConnection } from "@/hooks/use-telegram-connection";
import { Button } from "@openstatus/ui/components/ui/button";
import type { UseFormReturn } from "react-hook-form";
import { TelegramManualInput } from "./telegram-manual-input";
import { TelegramQRConnection } from "./telegram-qr-connection";

interface TelegramConnectionFlowProps {
  form: UseFormReturn<any>;
  mode: "qr" | "manual" | null;
  onModeChange: (mode: "qr" | "manual" | null) => void;
}

export function TelegramConnectionFlow({
  form,
  mode,
  onModeChange,
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
  } = useTelegramConnection({ form, mode });

  return (
    <>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <Button
          type="button"
          variant={mode === "qr" ? "default" : "outline"}
          size="sm"
          onClick={() => onModeChange("qr")}
          className="w-full cursor-pointer"
        >
          Connect with QR
        </Button>
        <div className="flex min-w-[40px] items-center gap-2">
          <div className="h-px flex-1 bg-border" />
          <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
            Or
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <Button
          type="button"
          variant={mode === "manual" ? "default" : "outline"}
          size="sm"
          onClick={() => onModeChange("manual")}
          className="w-full cursor-pointer"
        >
          Enter ChatID manually
        </Button>
      </div>

      {mode === "manual" && <TelegramManualInput form={form} />}
      {mode === "qr" && (
        <TelegramQRConnection
          form={form}
          token={tokenData?.token}
          isLoading={isTokenLoading}
          isPolling={isPolling}
          flowStep={flowStep}
          privateChatId={privateChatId}
          userName={userName}
          groupTitle={groupTitle}
          onReset={resetConnection}
        />
      )}
    </>
  );
}
