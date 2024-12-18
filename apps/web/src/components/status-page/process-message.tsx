import type { AnchorHTMLAttributes } from "react";
import { Fragment, createElement } from "react";
import rehypeReact from "rehype-react";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

export function ProcessMessage({ value }: { value: string }) {
  return unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeReact, {
      createElement,
      Fragment,
      components: {
        a: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => {
          return <a target="_blank" rel="noreferrer" {...props} />;
        },
      } as { [key: string]: React.ComponentType<unknown> },
    })
    .processSync(value).result;
}
