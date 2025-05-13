"use client";

import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { Button } from "@openstatus/ui";
import { Copy } from "lucide-react";

export function CopyButton({ id }: { id: string }) {
  const { copy } = useCopyToClipboard();
  return (
    <Button
      variant="ghost"
      className="font-mono"
      onClick={() => {
        copy(id, {
          withToast: `Copied ID '${id}'`,
        });
      }}
    >
      <Copy className="h-4 w-4 mr-2 text-muted-foreground" />
      {id}
    </Button>
  );
}
