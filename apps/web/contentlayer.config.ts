import { makeSource } from "contentlayer/source-files";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { LegalPost } from "./src/contentlayer/documents/legal";
import { Post } from "./src/contentlayer/documents/post";
import autolinkHeadings from "./src/contentlayer/plugins/autolink-headings";
import prettyCode from "./src/contentlayer/plugins/pretty-code";

export default makeSource({
  contentDirPath: "src/content/",
  documentTypes: [Post, LegalPost],
  mdx: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeSlug, prettyCode, autolinkHeadings],
  },
});
