import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CustomMDX } from "@/content/mdx";
import { CustomImage } from "@/content/mdx-components/custom-image";
import { getCustomerPages } from "@/content/utils";
import { JsonLd } from "@/lib/metadata/json-ld";
import { BASE_URL, getPageMetadata } from "@/lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDBreadcrumbList,
  getJsonLDFAQPage,
  getJsonLDOrganization,
  getJsonLDWebPage,
} from "@/lib/metadata/structured-data";

export const dynamicParams = false;

export async function generateStaticParams() {
  const pages = getCustomerPages();

  return pages.map((page) => ({
    slug: page.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata | undefined> {
  const { slug } = await params;
  const page = getCustomerPages().find((page) => page.slug === slug);
  if (!page) {
    return;
  }

  const metadata = getPageMetadata(page, "customers");

  return metadata;
}

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getCustomerPages().find((page) => page.slug === slug);

  if (!page) {
    notFound();
  }

  const jsonLDGraph = createJsonLDGraph([
    getJsonLDOrganization(),
    getJsonLDWebPage(page),
    getJsonLDBreadcrumbList([
      { name: "Home", url: BASE_URL },
      { name: "Customers", url: `${BASE_URL}/customers` },
      { name: page.metadata.title, url: `${BASE_URL}/customers/${slug}` },
    ]),
    getJsonLDFAQPage(page),
  ]);

  return (
    <section className="prose dark:prose-invert max-w-none">
      <JsonLd graph={jsonLDGraph} />
      {page.metadata.image ? (
        <CustomImage
          src={page.metadata.image}
          alt={page.metadata.title}
          disableZoom
          className="h-8 w-auto"
        />
      ) : null}
      <h1>{page.metadata.hero ?? page.metadata.title}</h1>
      <CustomMDX source={page.content} />
    </section>
  );
}
