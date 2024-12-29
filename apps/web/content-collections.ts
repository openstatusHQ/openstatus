import { defineCollection, defineConfig } from "@content-collections/core";
import { compileMDX } from "@content-collections/mdx";
import readingTime from "reading-time";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";

const autolinkHeadings = [
  rehypeAutolinkHeadings,
  {
    behavior: "append",
    headingProperties: {
      className: "group",
    },
    properties: {
      className: [
        "no-underline group-hover:after:content-['#'] after:text-muted-foreground/30 after:hover:text-muted-foreground ml-1 after:p-1",
      ],
      "aria-hidden": "true",
    },
  },
];

const prettyCode = [
  rehypePrettyCode,
  {
    theme: {
      dark: "github-dark-dimmed",
      light: "github-light",
    },
    grid: true,
    keepBackground: false,
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    onVisitLine(node: any) {
      // Prevent lines from collapsing in `display: grid` mode, and
      // allow empty lines to be copy/pasted
      if (node.children.length === 0) {
        node.children = [{ type: "text", value: " " }];
      }
    },
  },
];

const posts = defineCollection({
  name: "Posts",
  directory: "src/content/posts",
  include: "**/*.mdx",
  schema: (z) => ({
    title: z.string(),
    description: z.string(),
    image: z.string(),
    publishedAt: z.coerce.date(),
    author: z.object({
      name: z.string(),
      url: z.string().optional(),
      avatar: z.string().optional(),
    }),
    tag: z.enum(["company", "engineering", "education"]),
  }),
  transform: async (document, context) => {
    const mdx = await compileMDX(context, document, {
      // @ts-expect-error
      rehypePlugins: [rehypeSlug, prettyCode, autolinkHeadings],
    });
    return {
      ...document,
      mdx,
      slug: document._meta.fileName.replace(/\.mdx$/, ""),
      readingTime: readingTime(document.content).text,
    };
  },
});

const legals = defineCollection({
  name: "Legals",
  directory: "src/content/legal",
  include: "**/*.mdx",
  schema: (z) => ({
    title: z.string(),
    updatedAt: z.string(),
  }),
  transform: async (document, context) => {
    const mdx = await compileMDX(context, document, {
      // @ts-expect-error
      rehypePlugins: [rehypeSlug, prettyCode, autolinkHeadings],
    });
    return {
      ...document,
      mdx,
      slug: document._meta.fileName.replace(/\.mdx$/, ""),
    };
  },
});

const faqs = defineCollection({
  name: "FAQs",
  directory: "src/content/faq",
  include: "**/*.mdx",
  schema: (z) => ({
    title: z.string(),
    order: z.number(),
  }),
  transform: async (document, context) => {
    const mdx = await compileMDX(context, document, {
      // @ts-expect-error
      rehypePlugins: [rehypeSlug, prettyCode, autolinkHeadings],
    });
    return {
      ...document,
      mdx,
      slug: document._meta.fileName.replace(/\.mdx$/, ""),
    };
  },
});

const changelogs = defineCollection({
  name: "Changelogs",
  directory: "src/content/changelog",
  include: "**/*.mdx",
  schema: (z) => ({
    title: z.string(),
    description: z.string(),
    image: z.string(),
    publishedAt: z.coerce.date(),
  }),
  transform: async (document, context) => {
    const mdx = await compileMDX(context, document, {
      // @ts-expect-error
      rehypePlugins: [rehypeSlug, prettyCode, autolinkHeadings],
    });
    return {
      ...document,
      mdx,
      slug: document._meta.fileName.replace(/\.mdx$/, ""),
      readingTime: readingTime(document.content).text,
    };
  },
});

const unrelateds = defineCollection({
  name: "Unrelateds",
  directory: "src/content/unrelated",
  include: "**/*.mdx",
  schema: () => ({}),
  transform: async (document, context) => {
    const mdx = await compileMDX(context, document, {
      // @ts-expect-error
      rehypePlugins: [rehypeSlug, prettyCode, autolinkHeadings],
    });
    return {
      ...document,
      mdx,
      slug: document._meta.fileName.replace(/\.mdx$/, ""),
    };
  },
});

export default defineConfig({
  collections: [posts, legals, faqs, changelogs, unrelateds],
});
