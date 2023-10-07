import { defineDocumentType } from "contentlayer/source-files";
import readingTime from "reading-time";

export const Changelog = defineDocumentType(() => ({
  name: "Changelog",
  contentType: "mdx",
  filePathPattern: "changelog/*.mdx",
  fields: {
    title: {
      type: "string",
      required: true,
    },
    image: {
      type: "string",
      required: true,
    },
    publishedAt: { type: "date", required: true },
  },
  computedFields: {
    slug: {
      type: "string",
      resolve: (post) => post._raw.sourceFileName.replace(/\.mdx$/, ""),
    },
    readingTime: {
      type: "string",
      resolve: (post) => readingTime(post.body.raw).text,
    },
  },
}));
