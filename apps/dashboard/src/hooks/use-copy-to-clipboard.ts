import { useCallback, useState } from "react";
import { toast } from "sonner";

export function useCopyToClipboard() {
  const [text, setText] = useState<string | null>(null);

  const copy = useCallback(
    async (
      text: string,
      {
        timeout = 3000,
        withToast = true,
        successMessage = "Copied to clipboard",
      }: {
        timeout?: number;
        withToast?: boolean;
        successMessage?: string;
      },
    ) => {
      if (!navigator?.clipboard) {
        console.warn("Clipboard not supported");
        return false;
      }

      try {
        await navigator.clipboard.writeText(text);
        setText(text);

        if (timeout) {
          setTimeout(() => {
            setText(null);
          }, timeout);
        }

        if (withToast) {
          toast.success(successMessage);
        }

        return true;
      } catch (error) {
        console.warn("Copy failed", error);
        setText(null);
        return false;
      }
    },
    [],
  );

  return { text, copy, isCopied: text !== null };
}
