import { makeSource } from "contentlayer/source-files";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { Blog } from "./src/content/types/Blog";
import { rehypePrettyCodeOptions } from "./src/lib/rehypePrettyCode";

export default makeSource({
  // Location of source files for all defined documentTypes
  contentDirPath: "src/content/",
  documentTypes: [Blog],
  mdx: {
    remarkPlugins: [[remarkGfm]],
    rehypePlugins: [
      [rehypeSlug],
      [rehypePrettyCode, rehypePrettyCodeOptions],
      [
        rehypeAutolinkHeadings,
        {
          behavior: "wrap",
          properties: {
            className: `before:content-['#'] before:absolute before:-ml-[1em] before:text-white-100/0 hover:before:text-white-100/50 pl-[1em] -ml-[1em]`,
          },
        },
      ],
    ],
  },
});
