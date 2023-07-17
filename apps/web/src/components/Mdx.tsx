import { getMDXComponent } from "next-contentlayer/hooks";

import { components } from "./MdxComponents";

interface MdxProps {
  code: string;
}

export function Mdx({ code }: MdxProps) {
  const MDXComponent = getMDXComponent(code);

  return (
    <article className="prose prose-quoteless prose-neutral dark:prose-invert max-w-none">
      <MDXComponent components={{ ...components }} />
    </article>
  );
}
