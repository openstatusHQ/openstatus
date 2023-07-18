import { defineDocumentType } from "contentlayer/source-files";
import readingTime from "reading-time";

export const Blog = defineDocumentType(() => ({
  name: "Blog",
  contentType: "mdx",
  // Location of Blog source files (relative to `contentDirPath`)
  filePathPattern: "blog/*.mdx",

  fields: {
    title: {
      type: "string",
      required: true,
    },
    description: {
      type: "string",
      required: true,
    },
    publishedAt: { type: "string", required: true },
    author: {
      type: "string",
      required: true,
    },
    authorLink: {
      type: "string",
      required: true,
    },
  },

  computedFields: {
    // file name
    slug: {
      type: "string",
      resolve: (post) =>
        post._raw.sourceFileName
          // hello-world.mdx => hello-world
          .replace(/\.mdx$/, ""),
    },
    publishedAtFormatted: {
      // 2023-03-21 to March 21, 2023
      type: "string",
      resolve: (post) => {
        const date = new Date(post.publishedAt.split("-").join("-"));
        return (
          date.toLocaleString("default", { month: "long" }) +
          " " +
          date.getUTCDate() +
          ", " +
          date.getUTCFullYear()
        );
      },
    },
    readingTime: {
      type: "string",
      resolve: (post) => readingTime(post.body.raw).text,
    },
  },
}));
