import type { Metadata } from "next";
import Link from "next/link";

import { sections } from "../../../content/sections";
import { getChangelogPosts } from "../../../content/utils";
import { JsonLd } from "../../../lib/metadata/json-ld";
import { getListingMetadata } from "../../../lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDItemList,
  getJsonLDOrganization,
  getJsonLDSectionBreadcrumb,
} from "../../../lib/metadata/structured-data";
import { ContentCategory } from "../content-category";
import { ContentList } from "../content-list";

export const metadata: Metadata = getListingMetadata(sections.changelog);

export default function ChangelogListPage() {
  const allChangelogs = getChangelogPosts();
  const jsonLDGraph = createJsonLDGraph([
    getJsonLDOrganization(),
    getJsonLDSectionBreadcrumb(sections.changelog),
    getJsonLDItemList(allChangelogs, "/changelog"),
  ]);
  return (
    <div className="prose dark:prose-invert max-w-none">
      <JsonLd graph={jsonLDGraph} />
      <h1>Changelog</h1>
      <ContentCategory data={allChangelogs} prefix="/changelog" />
      <p>
        Get the{" "}
        <Link
          href="https://www.openstatus.dev/changelog/feed.xml"
          target="_blank"
        >
          RSS feed
        </Link>
      </p>
      <ContentList data={allChangelogs} prefix="/changelog" withCategory />
    </div>
  );
}
