import { MDXContent } from "@content-collections/mdx/react";

import { cn } from "@/lib/utils";
import { components } from "./mdx-components";

interface MdxProps {
  code: string;
  className?: string;
}

export function Mdx({ code, className }: MdxProps) {
  return (
    // FIXME: weird behaviour when `prose-headings:font-cal` and on mouse movement font gets bigger
    <div
      className={cn(
        "prose prose-slate dark:prose-invert prose-pre:my-0 prose-img:rounded-lg prose-pre:bg-background prose-pre:rounded-lg prose-img:border prose-pre:border prose-img:border-border prose-pre:border-border prose-headings:font-cal prose-headings:font-normal prose-blockquote:font-light prose-blockquote:border-l-2",
        className,
      )}
    >
      {/* @ts-expect-error FIXME: nextjs 15 migration */}
      <MDXContent code={code} components={components} />
    </div>
  );
}
