import { Button } from "@openstatus/ui/components/ui/button";
import type { UseFormReturn } from "react-hook-form";
import { TelegramManualInput } from "./telegram-manual-input";
import TelegramQRCode from "./telegram-qrcode";

interface TelegramQRConnectionProps {
  form: UseFormReturn<any>;
  token?: string;
  isLoading: boolean;
  isPolling?: boolean;
  flowStep: "private" | "group";
  privateChatId: string | null;
  onReset?: () => void;
}

export function TelegramQRConnection({
  form,
  token,
  isLoading,
  isPolling,
  flowStep,
  privateChatId,
  onReset,
}: TelegramQRConnectionProps) {
  const chatId = form.watch("data.chatId");

  if (chatId) {
    return (
      <div className="flex flex-col gap-2">
        <TelegramManualInput form={form} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReset}
          className="w-full"
        >
          Reset Group ID
        </Button>
      </div>
    );
  }

  return (
    <>
      {flowStep === "private" && (
        <div className="mb-2 text-muted-foreground text-sm">
          Step 1 of 2: Connect your Telegram account
        </div>
      )}
      {flowStep === "group" && privateChatId && (
        <div className="mb-2 text-muted-foreground text-sm">
          Step 2 of 2: Add bot to your group
        </div>
      )}
      <TelegramQRCode
        chatType={flowStep === "private" ? "private" : "group"}
        token={token}
        isLoading={isLoading}
        isPolling={isPolling}
      />
    </>
  );
}
