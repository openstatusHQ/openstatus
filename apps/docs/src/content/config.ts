import { defineCollection } from "astro:content";
import { docsSchema } from "@astrojs/starlight/schema";
// import { glob } from "astro/loaders";
import { topicSchema } from "starlight-sidebar-topics/schema";

export const collections = {
  docs: defineCollection({
    // loader: glob({ pattern: "**/*.mdx", base: "./src/content/docs" }),
    schema: docsSchema({ extend: topicSchema }),
  }),
};
