import { getChangelogPosts } from "@/content/utils";
import Link from "next/link";
import { ContentList } from "../content-list";

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
      <ContentList data={allChangelogs} prefix="/landing/changelog" />
    </div>
  );
}
