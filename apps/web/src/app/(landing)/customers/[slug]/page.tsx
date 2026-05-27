import { CustomMDX } from "@/content/mdx";
import { getCustomerPages } from "@/content/utils";
import { BASE_URL, getPageMetadata } from "@/lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDBreadcrumbList,
  getJsonLDFAQPage,
  getJsonLDOrganization,
  getJsonLDWebPage,
} from "@/lib/metadata/structured-data";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

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
}: { params: Promise<{ slug: string }> }) {
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
      <script
        type="application/ld+json"
        suppressHydrationWarning
        // biome-ignore lint/security/noDangerouslySetInnerHtml: jsonLd
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLDGraph).replace(/</g, "\\u003c"),
        }}
      />
      {page.metadata.image ? (
        <div className="relative mb-6 h-12 w-full">
          <Image
            src={page.metadata.image}
            alt={page.metadata.title}
            fill
            className="object-contain object-left dark:hidden"
          />
          {page.metadata.imageDark ? (
            <Image
              src={page.metadata.imageDark}
              alt={page.metadata.title}
              fill
              className="hidden object-contain object-left dark:block"
            />
          ) : null}
        </div>
      ) : null}
      <h1>{page.metadata.title}</h1>
      <CustomMDX source={page.content} />
    </section>
  );
}
