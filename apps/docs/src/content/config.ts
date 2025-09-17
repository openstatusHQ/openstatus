import { defineCollection } from "astro:content";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
// import { glob } from "astro/loaders";

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    // loader: glob({ pattern: "**/*.mdx", base: "./src/content/docs" }),
    schema: docsSchema(),
  }),
};
