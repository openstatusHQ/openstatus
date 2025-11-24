import type { AnchorHTMLAttributes } from "react";
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
        a: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => {
          return (
            <a
              target="_blank"
              rel="noreferrer"
              className="underline"
              {...props}
            />
          );
        },
      } as { [key: string]: React.ComponentType<unknown> },
    })
    .processSync(value).result;

  return result;
}
