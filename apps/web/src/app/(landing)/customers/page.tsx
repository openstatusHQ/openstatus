import type { Metadata } from "next";

import { components } from "../../../content/mdx";
import { sections } from "../../../content/sections";
import { getCustomerPages } from "../../../content/utils";
import { JsonLd } from "../../../lib/metadata/json-ld";
import { getListingMetadata } from "../../../lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDItemList,
  getJsonLDOrganization,
  getJsonLDSectionBreadcrumb,
} from "../../../lib/metadata/structured-data";
import {
  ContentBoxDescription,
  ContentBoxLink,
  ContentBoxTitle,
  ContentBoxUrl,
} from "../content-box";
import { ContentBoxImage } from "../content-box-image";

export const metadata: Metadata = getListingMetadata(sections.customers);

export default function CustomersListPage() {
  const pages = getCustomerPages();
  const jsonLDGraph = createJsonLDGraph([
    getJsonLDOrganization(),
    getJsonLDSectionBreadcrumb(sections.customers),
    getJsonLDItemList(pages, "/customers"),
  ]);
  return (
    <section className="prose dark:prose-invert max-w-none">
      <JsonLd graph={jsonLDGraph} />
      <h1>{sections.customers.title}</h1>
      <p className="text-lg">{sections.customers.description}</p>
      <components.Grid cols={2}>
        {pages.map((page) => (
          <ContentBoxLink key={page.slug} href={`/customers/${page.slug}`}>
            {page.metadata.image ? (
              <ContentBoxImage
                src={page.metadata.image}
                alt={page.metadata.title}
              />
            ) : null}
            <ContentBoxTitle>{page.metadata.title}</ContentBoxTitle>
            <ContentBoxDescription>
              {page.metadata.description}
            </ContentBoxDescription>
            <ContentBoxUrl url="Read the story" />
          </ContentBoxLink>
        ))}
      </components.Grid>
    </section>
  );
}
