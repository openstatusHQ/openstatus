import type { Metadata } from "next";

import { getUseCasePages } from "../../../content/utils";
import { JsonLd } from "../../../lib/metadata/json-ld";
import {
  BASE_URL,
  defaultMetadata,
  ogMetadata,
} from "../../../lib/metadata/shared-metadata";
import { twitterMetadata } from "../../../lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDBreadcrumbList,
  getJsonLDItemList,
  getJsonLDOrganization,
} from "../../../lib/metadata/structured-data";
import { ContentList } from "../content-list";

const TITLE = "Use Cases";
const DESCRIPTION =
  "Discover how teams use OpenStatus for compliance, reducing support tickets, closing enterprise deals, open-source projects, crypto exchanges, and API infrastructure.";

export const metadata: Metadata = {
  ...defaultMetadata,
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/use-case",
  },
  openGraph: {
    ...ogMetadata,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    ...twitterMetadata,
    title: TITLE,
    description: DESCRIPTION,
    images: [`/api/og?title=${TITLE}&description=${DESCRIPTION}`],
  },
};

export default function UseCaseListPage() {
  const allUseCases = getUseCasePages();
  const jsonLDGraph = createJsonLDGraph([
    getJsonLDOrganization(),
    getJsonLDBreadcrumbList([
      { name: "Home", url: BASE_URL },
      { name: "Use Cases", url: `${BASE_URL}/use-case` },
    ]),
    getJsonLDItemList(allUseCases, "/use-case"),
  ]);
  return (
    <div className="prose dark:prose-invert max-w-none">
      <JsonLd graph={jsonLDGraph} />
      <h1>Use Cases</h1>
      <ContentList data={allUseCases} prefix="/use-case" withCategory />
    </div>
  );
}
