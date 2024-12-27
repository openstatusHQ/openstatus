"use client";

import { cn } from "@/lib/utils";
import { Button } from "@openstatus/ui/src/components/button";
import { Clipboard, ClipboardCopy } from "lucide-react";
import React from "react";
export interface PreProps extends React.HTMLAttributes<HTMLPreElement> {}

export default function Pre({ children, className, ...props }: PreProps) {
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
    <div className="relative hidden overflow-hidden dark:[&:has([data-theme='dark'])]:block [&:has([data-theme='light'])]:block dark:[&:has([data-theme='light'])]:hidden">
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
      <pre ref={ref} className={cn("[&_code]:grid", className)} {...props}>
        {children}
      </pre>
    </div>
  );
}
