import fs from "node:fs";
import path from "node:path";
import slugify from "slugify";
import { z } from "zod";

const metadataSchema = z.object({
  title: z.string(),
  publishedAt: z.coerce.date(),
  description: z.string(),
  category: z.string(),
  author: z.string(),
  image: z.string().optional(),
});

export type Metadata = z.infer<typeof metadataSchema>;

function parseFrontmatter(fileContent: string) {
  const frontmatterRegex = /---\s*([\s\S]*?)\s*---/;
  const match = frontmatterRegex.exec(fileContent);
  const frontMatterBlock = match?.[1];
  const content = fileContent.replace(frontmatterRegex, "").trim();
  const frontMatterLines = frontMatterBlock?.trim().split("\n");
  const metadata: Record<string, string> = {};

  frontMatterLines?.forEach((line) => {
    const [key, ...valueArr] = line.split(": ");
    let value = valueArr.join(": ").trim();
    value = value.replace(/^['"](.*)['"]$/, "$1"); // Remove quotes
    metadata[key.trim()] = value;
  });

  const validatedMetadata = metadataSchema.safeParse(metadata);

  if (!validatedMetadata.success) {
    console.error(validatedMetadata.error);
    throw new Error(`Invalid metadata ${fileContent}`);
  }

  return { metadata: validatedMetadata.data, content };
}

function getMDXFiles(dir: string) {
  return fs.readdirSync(dir).filter((file) => path.extname(file) === ".mdx");
}

function readMDXFile(filePath: string) {
  const rawContent = fs.readFileSync(filePath, "utf-8");
  return parseFrontmatter(rawContent);
}

function getMDXDataFromDir(dir: string, prefix = "") {
  const mdxFiles = getMDXFiles(dir);
  return mdxFiles.map((file) => {
    return getMDXDataFromFile(path.join(dir, file), prefix);
  });
}

function getMDXDataFromFile(filePath: string, prefix = "") {
  const { metadata, content } = readMDXFile(filePath);
  const slugRaw = path.basename(filePath, path.extname(filePath));
  const slug = slugify(slugRaw, { lower: true, strict: true });
  const href = prefix ? `${prefix}/${slug}` : `/${slug}`;
  return {
    metadata,
    slug,
    content,
    href,
  };
}

export type MDXData = ReturnType<typeof getMDXDataFromFile>;

export function getBlogPosts(): MDXData[] {
  return getMDXDataFromDir(
    path.join(process.cwd(), "src", "content", "pages", "blog"),
    "/blog",
  );
}

export function getChangelogPosts(): MDXData[] {
  return getMDXDataFromDir(
    path.join(process.cwd(), "src", "content", "pages", "changelog"),
    "/changelog",
  );
}

export function getProductPages(): MDXData[] {
  return getMDXDataFromDir(
    path.join(process.cwd(), "src", "content", "pages", "product"),
    "",
  );
}

export function getGuides(): MDXData[] {
  return getMDXDataFromDir(
    path.join(process.cwd(), "src", "content", "pages", "guides"),
    "/guides",
  );
}

export function getUnrelatedPages(): MDXData[] {
  return getMDXDataFromDir(
    path.join(process.cwd(), "src", "content", "pages", "unrelated"),
    "",
  );
}

export function getUnrelatedPage(slug: string): MDXData {
  return getMDXDataFromFile(
    path.join(
      process.cwd(),
      "src",
      "content",
      "pages",
      "unrelated",
      `${slug}.mdx`,
    ),
    "",
  );
}

export function getMainPages(): MDXData[] {
  return [...getUnrelatedPages(), ...getProductPages()];
}

export function getComparePages(): MDXData[] {
  return getMDXDataFromDir(
    path.join(process.cwd(), "src", "content", "pages", "compare"),
    "/compare",
  );
}

export function getHomePage(): MDXData {
  return getMDXDataFromFile(
    path.join(process.cwd(), "src", "content", "pages", "home.mdx"),
    "",
  );
}

export function getToolsPages(): MDXData[] {
  return getMDXDataFromDir(
    path.join(process.cwd(), "src", "content", "pages", "tools"),
    "/play",
  );
}

export function getToolsPage(slug: string): MDXData {
  return getMDXDataFromFile(
    path.join(process.cwd(), "src", "content", "pages", "tools", `${slug}.mdx`),
    "/play",
  );
}

export const PAGE_TYPES = [
  "blog",
  "changelog",
  "product",
  "unrelated",
  "compare",
  "tools",
  "all",
] as const;

export type PageType = (typeof PAGE_TYPES)[number];

export function getPages(type: PageType) {
  switch (type) {
    case "blog":
      return getBlogPosts();
    case "changelog":
      return getChangelogPosts();
    case "product":
      return getProductPages();
    case "unrelated":
      return getUnrelatedPages();
    case "compare":
      return getComparePages();
    case "tools":
      return getToolsPages();
    case "all":
      return [
        ...getBlogPosts(),
        ...getChangelogPosts(),
        ...getProductPages(),
        ...getUnrelatedPages(),
        ...getComparePages(),
        ...getToolsPages(),
      ];
    default:
      throw new Error(`Unknown page type: ${type}`);
  }
}

export function getCategories() {
  return [
    ...new Set([
      ...getBlogPosts().map((post) => post.metadata.category),
      ...getChangelogPosts().map((post) => post.metadata.category),
      ...getProductPages().map((post) => post.metadata.category),
      ...getUnrelatedPages().map((post) => post.metadata.category),
      ...getComparePages().map((post) => post.metadata.category),
      ...getToolsPages().map((post) => post.metadata.category),
    ]),
  ] as const;
}

export function formatDate(targetDate: Date, includeRelative = false) {
  const currentDate = new Date();

  const yearsAgo = currentDate.getFullYear() - targetDate.getFullYear();
  const monthsAgo = currentDate.getMonth() - targetDate.getMonth();
  const daysAgo = currentDate.getDate() - targetDate.getDate();

  let formattedDate = "";

  if (yearsAgo > 0) {
    formattedDate = `${yearsAgo}y ago`;
  } else if (monthsAgo > 0) {
    formattedDate = `${monthsAgo}mo ago`;
  } else if (daysAgo > 0) {
    formattedDate = `${daysAgo}d ago`;
  } else {
    formattedDate = "Today";
  }

  const fullDate = targetDate.toLocaleString("en-us", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

  if (!includeRelative) {
    return fullDate;
  }

  return `${fullDate} (${formattedDate})`;
}
