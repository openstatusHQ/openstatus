import { getMDXComponent } from "next-contentlayer/hooks";

import { cn } from "@/lib/utils";
import { components } from "./mdx-components";

interface MdxProps {
  code: string;
  className?: string;
}

export function Mdx({ code, className }: MdxProps) {
  const MDXComponent = getMDXComponent(code);

  return (
    // FIXME: weird behaviour when `prose-headings:font-cal` and on mouse movement font gets bigger
    <div
      className={cn(
        "prose prose-slate dark:prose-invert prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-img:rounded-lg prose-img:border prose-img:border-border",
        className,
      )}
    >
      <MDXComponent components={{ ...components }} />
    </div>
  );
}
