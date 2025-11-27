import { CustomMDX } from "@/content/mdx";
import { getMainPages } from "@/content/utils";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPageMetadata } from "@/app/shared-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata | undefined> {
  const { slug } = await params;
  const page = getMainPages().find((page) => page.slug === slug);
  if (!page) {
    return;
  }

  const metadata = getPageMetadata(page);

  return metadata;
}

export async function generateStaticParams() {
  const pages = getMainPages();

  return pages.map((page) => ({
    slug: page.slug,
  }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getMainPages().find((page) => page.slug === slug);

  if (!page) {
    notFound();
  }

  return (
    <section className="prose dark:prose-invert max-w-none">
      <h1>{page.metadata.title}</h1>
      <p className="text-lg">{page.metadata.description}</p>
      <CustomMDX source={page.content} />
    </section>
  );
}
