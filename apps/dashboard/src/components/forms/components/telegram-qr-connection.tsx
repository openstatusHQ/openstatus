import TelegramQRCode from "./telegram-qrcode";
import { TelegramManualInput } from "./telegram-manual-input";
import { UseFormReturn } from "react-hook-form";

interface TelegramQRConnectionProps {
  form: UseFormReturn<any>;
  token?: string;
  isLoading: boolean;
  isPolling?: boolean;
}

export function TelegramQRConnection({
  form,
  token,
  isLoading,
  isPolling,
}: TelegramQRConnectionProps) {
  const chatId = form.watch("data.chatId");

  if (chatId) {
    return <TelegramManualInput form={form} />;
  }

  return (
    <TelegramQRCode
      chatType="private"
      token={token}
      isLoading={isLoading}
      isPolling={isPolling}
    />
  );
}
