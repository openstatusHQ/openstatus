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
        "prose prose-slate dark:prose-invert prose-pre:my-0 prose-img:rounded-lg prose-pre:rounded-lg prose-img:border prose-pre:border prose-img:border-border prose-pre:border-border prose-headings:font-cal prose-headings:font-normal",
        className,
      )}
    >
      <MDXComponent components={{ ...components }} />
    </div>
  );
}
