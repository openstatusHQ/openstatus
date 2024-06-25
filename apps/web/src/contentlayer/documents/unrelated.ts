import { defineDocumentType } from "contentlayer/source-files";

export const Unrelated = defineDocumentType(() => ({
  name: "Unrelated",
  filePathPattern: "unrelated/*.mdx",
  contentType: "mdx",
  fields: {},
  computedFields: {
    slug: {
      type: "string",
      resolve: (post) => post._raw.sourceFileName.replace(/\.mdx$/, ""),
    },
  },
}));
