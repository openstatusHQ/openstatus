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
}

export function TelegramQRConnection({
  form,
  token,
  isLoading,
  isPolling,
  flowStep,
  privateChatId,
}: TelegramQRConnectionProps) {
  const chatId = form.watch("data.chatId");

  if (chatId) {
    return <TelegramManualInput form={form} />;
  }

  return (
    <>
      {flowStep === "private" && (
        <div className="text-sm text-muted-foreground mb-2">
          Step 1 of 2: Connect your Telegram account
        </div>
      )}
      {flowStep === "group" && privateChatId && (
        <div className="text-sm text-muted-foreground mb-2">
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
