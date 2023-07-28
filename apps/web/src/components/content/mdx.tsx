import { getMDXComponent } from "next-contentlayer/hooks";

import { components } from "./mdx-components";

interface MdxProps {
  code: string;
}

export function Mdx({ code }: MdxProps) {
  const MDXComponent = getMDXComponent(code);

  return (
    // FIXME: weird behaviour when `prose-headings:font-cal` and on mouse movement font gets bigger
    <div className="prose prose-neutral dark:prose-invert prose-pre:border prose-pre:border-border prose-pre:rounded-lg">
      <MDXComponent components={{ ...components }} />
    </div>
  );
}
