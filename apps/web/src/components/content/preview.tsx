"use client";

import { useProcessor } from "@/hooks/use-preprocessor";

interface Props {
  md?: string;
}

export function Preview({ md }: Props) {
  const Component = useProcessor(md || "");
  return (
    <div className="prose dark:prose-invert prose-sm prose-headings:font-cal border-input h-[158px] w-full overflow-auto rounded-md border px-3 py-2">
      {Component}
    </div>
  );
}
