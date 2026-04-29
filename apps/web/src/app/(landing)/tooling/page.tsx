import { getToolingPages } from "@/content/utils";
import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/lib/metadata/shared-metadata";
import type { Metadata } from "next";
import { ContentList } from "../content-list";

const TITLE = "Tooling";
const DESCRIPTION =
  "Manage status pages and uptime monitoring from anywhere your workflow lives — CLI, ConnectRPC API, Node SDK, Terraform provider, and MCP server, all on a single API key.";

export const metadata: Metadata = {
  ...defaultMetadata,
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/tooling",
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

export default function ToolingListPage() {
  const pages = getToolingPages();
  return (
    <div className="prose dark:prose-invert max-w-none">
      <h1>{TITLE}</h1>
      <p className="text-lg">{DESCRIPTION}</p>
      <p>
        Openstatus is built for engineers. Everything the dashboard does —
        managing uptime monitors, publishing status pages, posting status
        reports, scheduling maintenance — is also reachable from your terminal,
        CI pipeline, Terraform plan, and AI assistant. Same workspace, same API
        key, same audit log.
      </p>
      <ContentList data={pages} prefix="/tooling" />
    </div>
  );
}
