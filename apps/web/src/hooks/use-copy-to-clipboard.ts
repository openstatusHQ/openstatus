import { useCallback, useState } from "react";
import { toast } from "sonner";

export function useCopyToClipboard() {
  const [text, setText] = useState<string | null>(null);

  const copy = useCallback(
    async (
      text: string,
      {
        timeout = 3000,
        withToast = false,
      }: { timeout?: number; withToast?: boolean | string },
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
          if (typeof withToast === "string") {
            toast.success(withToast);
          } else {
            toast.success("Copied to clipboard");
          }
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
