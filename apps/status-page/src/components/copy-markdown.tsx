import { Button } from "@openstatus/ui/components/button";
import { Check, Copy } from "lucide-react";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";

interface CopyMarkdownProps {
  markdown: string;
}

export const CopyMarkdown = ({ markdown }: CopyMarkdownProps) => {
  const { copied, copy } = useCopyToClipboard({ timeout: 2000 });

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => copy(markdown)}
      className="gap-2"
      type="button"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-success" />
          <span>Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" />
          <span>Copy markdown</span>
        </>
      )}
    </Button>
  );
};
