import type { AnchorHTMLAttributes } from "react";
import { Fragment, createElement, useEffect, useState } from "react";
import rehypeReact from "rehype-react";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

export function useProcessor(text: string) {
  const [Content, setContent] = useState<React.ReactNode>(null);

  useEffect(() => {
    unified()
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
      .process(text)
      .then((file) => {
        setContent(file.result);
      });
  }, [text]);

  return Content;
}
