import { QRCode } from "@openstatus/ui/components/ui/qr-code";
import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import { Loader2 } from "lucide-react";

export default function TelegramQRCode({
  chatType,
  token,
  isLoading,
  isPolling,
}: {
  chatType: "group" | "private";
  token?: string | undefined;
  isLoading: boolean;
  isPolling?: boolean;
}) {
  const telegramBotUserName = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

  //   Grpoup : t.me/<bot_username>?startgroup=<parameter>&admin=<permissions>
  // Private Chat: t.me/<bot_username>?start=<parameter>

  const qrURL =
    chatType === "group"
      ? `https://t.me/${telegramBotUserName}?startgroup=${token}&admin=post_messages`
      : `https://t.me/${telegramBotUserName}?start=${token}`;

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      {isLoading ? (
        <Skeleton className="h-[200px] w-[200px]" />
      ) : token ? (
        <QRCode data={qrURL} />
      ) : null}
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        {isLoading ? (
          "Generating QR Code..."
        ) : isPolling ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            {chatType === "private"
              ? "Retrieving your account..."
              : "Waiting for group connection..."}
          </>
        ) : (
          chatType === "private"
            ? "Scan the QR code to connect your account"
            : "Scan to add the bot to your group"
        )}
      </div>
    </div>
  );
}
