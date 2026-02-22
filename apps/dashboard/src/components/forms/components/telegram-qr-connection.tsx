import { Button } from "@openstatus/ui/components/ui/button";
import { Input } from "@openstatus/ui/components/ui/input";
import { Label } from "@openstatus/ui/components/ui/label";
import type { UseFormReturn } from "react-hook-form";
import type { FormValues } from "../notifications/form-telegram";
import { TelegramManualInput } from "./telegram-manual-input";
import TelegramQRCode from "./telegram-qrcode";

interface TelegramQRConnectionProps {
  form: UseFormReturn<FormValues>;
  token?: string;
  isLoading: boolean;
  isPolling?: boolean;
  flowStep: "private" | "group";
  privateChatId: string | null;
  userName?: string | null;
  groupTitle?: string | null;
  onReset?: () => void;
}

export function TelegramQRConnection({
  form,
  token,
  isLoading,
  isPolling,
  flowStep,
  privateChatId,
  userName,
  groupTitle,
  onReset,
}: TelegramQRConnectionProps) {
  const chatId = form.watch("data.chatId");

  // When we have a group chat ID, show the manual input with group name
  if (chatId) {
    return (
      <div className="flex flex-col gap-2">
        <TelegramManualInput
          form={form}
          successMsg={`Connected to ${groupTitle}`}
          showDescription={false}
        />
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

  // When we have a private chat ID, show read-only info with second QR code
  if (privateChatId && flowStep === "group") {
    return (
      <div className="flex flex-col gap-4">
        {/* Show read-only private chat info */}
        <div className="space-y-2">
          <Label>Private Chat ID</Label>
          <Input value={privateChatId} readOnly className="bg-muted" />
          {userName && (
            <div className="font-medium text-green-600 text-sm">
              {`Connected to: ${userName}`}
            </div>
          )}
        </div>

        {/* Show second QR code for group connection */}
        <div className="mb-2 text-muted-foreground text-sm">
          Step 2 of 2: Add bot to your group
        </div>
        <TelegramQRCode
          chatType="group"
          token={token}
          isLoading={isLoading}
          isPolling={isPolling}
        />
      </div>
    );
  }

  // Initial state: show first QR code for private chat connection
  return (
    <>
      <div className="mb-2 text-muted-foreground text-sm">
        Step 1 of 2: Connect your Telegram account
      </div>
      <TelegramQRCode
        chatType="private"
        token={token}
        isLoading={isLoading}
        isPolling={isPolling}
      />
    </>
  );
}
