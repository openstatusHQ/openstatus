import { cn } from "@openstatus/ui/lib/utils";
import type { UIMessage } from "ai";
import type {
  AnchorHTMLAttributes,
  ComponentProps,
  HTMLAttributes,
} from "react";
import { Fragment, createElement } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import rehypeReact from "rehype-react";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

export function Message({ className, from, ...props }: MessageProps) {
  return (
    <div
      data-from={from}
      className={cn(
        "group flex w-full max-w-[95%] flex-col gap-2",
        from === "user" ? "ml-auto items-end" : "items-start",
        className,
      )}
      {...props}
    />
  );
}

export function MessageContent({
  className,
  children,
  ...props
}: ComponentProps<"div"> & { from?: UIMessage["role"] }) {
  return (
    <div
      className={cn(
        "flex w-full max-w-full flex-col gap-2 overflow-hidden text-sm",
        // User-only bubble; assistant Markdown renders inline against the page.
        "group-data-[from=user]:rounded-xl group-data-[from=user]:bg-secondary group-data-[from=user]:px-4 group-data-[from=user]:py-3",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeReact, {
    createElement,
    Fragment,
    jsx,
    jsxs,
    components: {
      a: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a target="_blank" rel="noreferrer" className="underline" {...props} />
      ),
      code: (props: HTMLAttributes<HTMLElement>) => (
        <code
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]"
          {...props}
        />
      ),
      pre: (props: HTMLAttributes<HTMLPreElement>) => (
        <pre
          className="overflow-x-auto rounded-md border bg-muted p-3 text-xs"
          {...props}
        />
      ),
    } as { [key: string]: React.ComponentType<unknown> },
  });

/** Streaming-safe: `processSync` re-runs each render so partial markdown renders progressively. */
export function MessageMarkdown({ children }: { children: string }) {
  return (
    <div
      className={cn(
        "space-y-2 leading-relaxed",
        "[&_li]:ml-4 [&_li]:list-disc [&_ol]:list-decimal",
        "[&_strong]:font-semibold",
        "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs",
        "[&_th]:border [&_th]:bg-muted/50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-medium",
        "[&_td]:border [&_td]:px-2 [&_td]:py-1",
      )}
    >
      {processor.processSync(children).result}
    </div>
  );
}
