import { defineDocumentType } from "contentlayer/source-files";

export const FAQ = defineDocumentType(() => ({
  name: "FAQ",
  filePathPattern: "faq/*.mdx",
  contentType: "mdx",
  fields: {
    title: {
      type: "string",
      required: true,
    },
    order: {
      type: "number",
      required: true,
    },
  },
  computedFields: {
    slug: {
      type: "string",
      resolve: (post) => post._raw.sourceFileName.replace(/\.mdx$/, ""),
    },
  },
}));
