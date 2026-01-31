import { CustomMDX } from "@/content/mdx";
import { getMainPages } from "@/content/utils";
import { BASE_URL, getPageMetadata } from "@/lib/metadata/shared-metadata";
import {
  getJsonLDBreadcrumbList,
  getJsonLDWebPage,
} from "@/lib/metadata/structured-data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { BreadcrumbList, WebPage, WithContext } from "schema-dts";

export const dynamicParams = false;

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

  const jsonLDWebPage: WithContext<WebPage> = getJsonLDWebPage(page);

  const jsonLDBreadcrumb: WithContext<BreadcrumbList> = getJsonLDBreadcrumbList(
    [
      { name: "Home", url: BASE_URL },
      { name: page.metadata.title, url: `${BASE_URL}/${slug}` },
    ],
  );

  return (
    <section className="prose dark:prose-invert max-w-none">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: jsonLd
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLDWebPage).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        // biome-ignore lint/security/noDangerouslySetInnerHtml: jsonLd
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLDBreadcrumb).replace(/</g, "\\u003c"),
        }}
      />
      <h1>{page.metadata.title}</h1>
      <p className="text-lg">{page.metadata.description}</p>
      <CustomMDX source={page.content} />
    </section>
  );
}
