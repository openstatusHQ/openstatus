import { defineDocumentType } from "contentlayer/source-files";
import readingTime from "reading-time";

export const Post = defineDocumentType(() => ({
  name: "Post",
  contentType: "mdx",
  // Location of Blog source files (relative to `contentDirPath`)
  filePathPattern: "posts/*.mdx",

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
        const dateObj = new Date(post.publishedAt);
        // https://stackoverflow.com/questions/66590691/typescript-type-string-is-not-assignable-to-type-numeric-2-digit-in-d
        const options = {
          year: "numeric",
          month: "long",
          day: "numeric",
        } as const;
        return dateObj.toLocaleDateString("en-US", options);
      },
    },
    readingTime: {
      type: "string",
      resolve: (post) => readingTime(post.body.raw).text,
    },
  },
}));
