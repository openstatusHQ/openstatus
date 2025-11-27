import {
  type AtlassianDescriptionEnum,
  externalStatusArray,
} from "@/app/(pages)/status/utils";
import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { components } from "@/content/mdx";
import { env } from "@/env";
import type { Metadata } from "next";
import {
  ContentBoxDescription,
  ContentBoxLink,
  ContentBoxTitle,
  ContentBoxUrl,
} from "../content-box";

const TITLE = "External Status";
const DESCRIPTION =
  "Easily check if your external providers is working properly";

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

export default async function Page() {
  const res = await fetch(env.EXTERNAL_API_URL);
  const data = await res.json();
  const externalStatus = externalStatusArray.parse(data);
  return (
    <section className="prose dark:prose-invert max-w-none">
      <h1>External Status</h1>
      <components.Grid cols={2}>
        {externalStatus.map((status) => (
          <ContentBoxLink
            key={status.name}
            href={status.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ContentBoxTitle>{status.name}</ContentBoxTitle>
            <ContentBoxDescription
              className={STATUS[status.status_description]}
            >
              {status.status_description}
            </ContentBoxDescription>
            <ContentBoxUrl url={status.url} />
          </ContentBoxLink>
        ))}
      </components.Grid>
    </section>
  );
}

const STATUS = {
  "All Systems Operational": "text-success",
  "Major System Outage": "text-destructive",
  "Partial System Outage": "text-warning",
  "Minor Service Outage": "text-warning",
  "Degraded System Service": "text-warning",
  "Partially Degraded Service": "text-warning",
  "Service Under Maintenance": "text-info",
} satisfies Record<AtlassianDescriptionEnum, string>;
