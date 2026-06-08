import type { Metadata } from "next";

import { getGuides } from "@/content/utils";
import { JsonLd } from "@/lib/metadata/json-ld";
import {
  BASE_URL,
  defaultMetadata,
  ogMetadata,
} from "@/lib/metadata/shared-metadata";
import { twitterMetadata } from "@/lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDBreadcrumbList,
  getJsonLDItemList,
  getJsonLDOrganization,
} from "@/lib/metadata/structured-data";

import { ContentCategory } from "../content-category";
import { ContentList } from "../content-list";

const TITLE = "Guides";
const DESCRIPTION = "All the latest guides from openstatus.";

export const metadata: Metadata = {
  ...defaultMetadata,
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/guides",
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

export default function GuidesListPage() {
  const allGuides = getGuides();
  const jsonLDGraph = createJsonLDGraph([
    getJsonLDOrganization(),
    getJsonLDBreadcrumbList([
      { name: "Home", url: BASE_URL },
      { name: "Guides", url: `${BASE_URL}/guides` },
    ]),
    getJsonLDItemList(allGuides, "/guides"),
  ]);
  return (
    <div className="prose dark:prose-invert max-w-none">
      <JsonLd graph={jsonLDGraph} />
      <h1>Guides</h1>
      <ContentCategory data={allGuides} prefix="/guides" />
      <ContentList data={allGuides} prefix="/guides" withCategory />
    </div>
  );
}
