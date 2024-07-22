"use client";

import { Button } from "@openstatus/ui";
import { Clipboard, ClipboardCopy } from "lucide-react";
import React from "react";

export interface PreProps extends React.HTMLAttributes<HTMLPreElement> {}

export default function Pre({ children, ...props }: PreProps) {
  const [copied, setCopied] = React.useState(false);
  const ref = React.useRef<HTMLPreElement>(null);

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (copied) {
      timer = setTimeout(() => {
        setCopied(false);
      }, 2000);
    }
    return () => {
      clearTimeout(timer);
    };
  }, [copied]);

  const onClick = () => {
    setCopied(true);
    const content = ref.current?.textContent;
    if (content) {
      navigator.clipboard.writeText(content);
    }
  };

  return (
    <div className="relative overflow-hidden">
      <Button
        variant="outline"
        size="icon"
        className="absolute top-2 right-2"
        onClick={onClick}
      >
        {!copied ? (
          <Clipboard className="h-5 w-5" />
        ) : (
          <ClipboardCopy className="h-5 w-5" />
        )}
      </Button>
      <pre ref={ref} {...props}>
        {children}
      </pre>
    </div>
  );
}
