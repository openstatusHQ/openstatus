import { MDXRemote, type MDXRemoteProps } from "next-mdx-remote/rsc";
import React from "react";
import remarkGfm from "remark-gfm";
import { HighlightText } from "./highlight-text";
import { components } from "./mdx-components";

export { components, slugify } from "./mdx-components";

function MDXContent(props: MDXRemoteProps) {
  return (
    <MDXRemote
      {...props}
      options={{
        blockJS: false, // Allow JS expressions in trusted MDX content
        blockDangerousJS: true, // Still block dangerous operations
        mdxOptions: {
          remarkPlugins: [remarkGfm],
          ...props.options?.mdxOptions,
        },
        ...props.options,
      }}
      components={
        {
          ...components,
          ...props.components,
        } as MDXRemoteProps["components"]
      }
    />
  );
}

export function CustomMDX(props: MDXRemoteProps) {
  return (
    <React.Suspense fallback={<MDXContent {...props} />}>
      <HighlightText>
        <MDXContent {...props} />
      </HighlightText>
    </React.Suspense>
  );
}
