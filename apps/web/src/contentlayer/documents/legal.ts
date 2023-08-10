import { defineDocumentType } from "contentlayer/source-files";

export const LegalPost = defineDocumentType(() => ({
  name: "LegalPost",
  filePathPattern: `legal/*.mdx`,
  contentType: "mdx",
  fields: {
    title: {
      type: "string",
      required: true,
    },
    updatedAt: {
      type: "string",
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
