import { useState } from "react";
import { Button } from "@openstatus/ui/components/button";
import { Check, Copy } from "lucide-react";

interface CopyMarkdownProps {
  markdown: string;
}

export const CopyMarkdown = ({ markdown }: CopyMarkdownProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy markdown:", error);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="gap-2"
      type="button"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-green-500" />
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
