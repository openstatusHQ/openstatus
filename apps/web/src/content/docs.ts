import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import {
  type DocsSection,
  flattenDocsNav,
  sectionForSlug,
} from "./docs.config";

// Docs reuse `category` as their section but, unlike blog/changelog, carry no
// author or publish date — so the shared `metadataSchema` is relaxed here.
const docsMetadataSchema = z.object({
  title: z.string(),
  description: z.string(),
  category: z.string(),
  publishedAt: z.coerce.date().optional(),
  author: z.string().optional(),
  image: z.string().optional(),
});

export type DocsMetadata = z.infer<typeof docsMetadataSchema>;

export type DocsData = {
  metadata: DocsMetadata;
  slug: string; // nested, e.g. "concept/getting-started"
  content: string;
  href: string; // "/docs/<slug>"
  filePath: string;
};

const DOCS_DIR = path.join(process.cwd(), "src", "content", "pages", "docs");

function walkMDX(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkMDX(full);
    return path.extname(entry.name) === ".mdx" ? [full] : [];
  });
}

function readDocsFile(filePath: string): DocsData {
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  const parsed = docsMetadataSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      `Invalid docs metadata in ${path.relative(DOCS_DIR, filePath)}: ${parsed.error.message}`,
    );
  }
  const rel = path.relative(DOCS_DIR, filePath).replace(/\.mdx$/, "");
  // `index.mdx` represents its directory: sdk/nodejs/index → sdk/nodejs
  const slug = rel
    .split(path.sep)
    .join("/")
    .replace(/\/index$|^index$/, "");
  return {
    metadata: parsed.data,
    content,
    slug,
    href: `/docs/${slug}`,
    filePath,
  };
}

export function getDocs(): DocsData[] {
  return walkMDX(DOCS_DIR).map(readDocsFile);
}

export function getDocsPage(slug: string): DocsData | undefined {
  const direct = path.join(DOCS_DIR, `${slug}.mdx`);
  if (fs.existsSync(direct)) return readDocsFile(direct);
  const asIndex = path.join(DOCS_DIR, slug, "index.mdx");
  if (fs.existsSync(asIndex)) return readDocsFile(asIndex);
  return undefined;
}

// Build-time consistency check. Split by severity so an incremental migration
// can still ship: a nav slug without a file yet is an expected `warning` (not
// ported), while a category mismatch or an orphan file (a doc that exists but
// isn't in the config) is a hard `error` — a real bug on a page that IS ported.
export function validateDocsNav(): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const docs = getDocs();
  const bySlug = new Map(docs.map((d) => [d.slug, d]));
  const navSlugs = new Set(flattenDocsNav().map((i) => i.slug));

  for (const { slug } of flattenDocsNav()) {
    const doc = bySlug.get(slug);
    if (!doc) {
      warnings.push(`nav references not-yet-ported doc: ${slug}`);
      continue;
    }
    const expected = sectionForSlug(slug);
    if (doc.metadata.category !== expected) {
      errors.push(
        `category mismatch for ${slug}: frontmatter "${doc.metadata.category}" ≠ config "${expected}"`,
      );
    }
  }

  for (const doc of docs) {
    if (!navSlugs.has(doc.slug)) {
      errors.push(`doc not listed in docs.config.ts: ${doc.slug}`);
    }
  }

  return { errors, warnings };
}

// Prev/next from the flattened nav order (not date-sorted like blog).
export function getDocsPagination(slug: string): {
  prev?: { slug: string; label: string };
  next?: { slug: string; label: string };
} {
  const flat = flattenDocsNav();
  const idx = flat.findIndex((i) => i.slug === slug);
  if (idx === -1) return {};
  return { prev: flat[idx - 1], next: flat[idx + 1] };
}

export function getDocsCategories(): DocsSection[] {
  return [
    ...new Set(getDocs().map((d) => d.metadata.category)),
  ] as DocsSection[];
}

// Last-updated from git history at build time. Returns undefined outside a git
// checkout (e.g. some CI shallow clones) so callers can fall back gracefully.
export function gitLastModified(filePath: string): Date | undefined {
  try {
    const iso = execFileSync(
      "git",
      ["log", "-1", "--format=%cI", "--", filePath],
      { encoding: "utf-8" },
    ).trim();
    return iso ? new Date(iso) : new Date();
  } catch {
    return undefined;
  }
}
