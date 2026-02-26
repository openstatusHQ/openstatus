import type { AnchorHTMLAttributes, HTMLAttributes } from "react";

import { Fragment, createElement } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import rehypeReact from "rehype-react";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

export function ProcessMessage({ value }: { value: string }) {
  const result = unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeReact, {
      createElement,
      Fragment,
      jsx,
      jsxs,
      components: {
        ul: (props: HTMLAttributes<HTMLUListElement>) => {
          return (
            <ul
              className="marker:text-muted-foreground/50 list-inside list-disc"
              {...props}
            />
          );
        },
        ol: (_props: HTMLAttributes<HTMLOListElement>) => {
          return (
            <ol className="marker:text-muted-foreground/50 list-inside list-decimal" />
          );
        },
        a: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => {
          return (
            <a
              target="_blank"
              rel="noreferrer"
              className="focus-visible:ring-ring/50 rounded-sm underline outline-none focus-visible:ring-[3px]"
              {...props}
            />
          );
        },
      } as { [key: string]: React.ComponentType<unknown> },
    })
    .processSync(value).result;

  return result;
}
