import { getMDXComponent } from "next-contentlayer/hooks";

import { components } from "./mdx-components";

interface MdxProps {
  code: string;
}

export function Mdx({ code }: MdxProps) {
  const MDXComponent = getMDXComponent(code);

  return (
    <main className="prose prose-quoteless prose-neutral dark:prose-invert mb-6 max-w-none">
      <MDXComponent components={{ ...components }} />
    </main>
  );
}
