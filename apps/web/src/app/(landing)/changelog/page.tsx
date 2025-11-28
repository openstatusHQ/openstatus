import { defaultMetadata, ogMetadata } from "@/app/shared-metadata";
import { twitterMetadata } from "@/app/shared-metadata";
import { getChangelogPosts } from "@/content/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { ContentList } from "../content-list";

const TITLE = "Changelog";
const DESCRIPTION = "All the latest changes and updates to OpenStatus.";

export const metadata: Metadata = {
  ...defaultMetadata,
  title: TITLE,
  description: DESCRIPTION,
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

export default function ChangelogListPage() {
  const allChangelogs = getChangelogPosts();
  return (
    <div className="prose dark:prose-invert max-w-none">
      <h1>Changelog</h1>
      <p>
        Get the{" "}
        <Link
          href="https://www.openstatus.dev/changelog/feed.xml"
          target="_blank"
        >
          RSS feed
        </Link>
      </p>
      <ContentList data={allChangelogs} prefix="/changelog" />
    </div>
  );
}
