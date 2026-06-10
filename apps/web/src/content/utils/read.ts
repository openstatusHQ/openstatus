import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";
import slugify from "slugify";

import { metadataSchema } from "./schema";

// `defaults` are merged under the file's frontmatter (file wins) before
// validation — lets callers supply fields the source omits (e.g. docs have no
// author/publishedAt) while still running the one shared schema.
export function parseFrontmatter(
  filePath: string,
  defaults?: Record<string, unknown>,
) {
  const { data, content } = matter(fs.readFileSync(filePath, "utf-8"));
  const parsed = metadataSchema.safeParse(
    defaults ? { ...defaults, ...data } : data,
  );
  if (!parsed.success) {
    console.error(parsed.error);
    throw new Error(`Invalid metadata in ${filePath}: ${parsed.error.message}`);
  }
  return { metadata: parsed.data, content };
}

function getMDXFiles(dir: string) {
  return fs.readdirSync(dir).filter((file) => path.extname(file) === ".mdx");
}

export function getMDXDataFromDir(dir: string, prefix = "") {
  return getMDXFiles(dir).map((file) =>
    getMDXDataFromFile(path.join(dir, file), prefix),
  );
}

export function getMDXDataFromFile(filePath: string, prefix = "") {
  const { metadata, content } = parseFrontmatter(filePath);
  const slugRaw = path.basename(filePath, path.extname(filePath));
  const slug = slugify(slugRaw, { lower: true, strict: true });
  const href = prefix ? `${prefix}/${slug}` : `/${slug}`;
  return {
    metadata,
    slug,
    content,
    href,
    filePath,
  };
}

export type MDXData = ReturnType<typeof getMDXDataFromFile>;
