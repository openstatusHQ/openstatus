import { components } from "@/content/mdx";
import { getComparePages } from "@/content/utils";
import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/lib/metadata/shared-metadata";
import type { Metadata } from "next";
import {
  ContentBoxDescription,
  ContentBoxLink,
  ContentBoxTitle,
  ContentBoxUrl,
} from "../content-box";

const TITLE = "Compare Uptime Monitoring & Status Page Alternatives";
const DESCRIPTION =
  "See how openstatus compares to BetterStack, UptimeRobot, Checkly, Instatus, and other monitoring tools. Side-by-side feature and pricing comparisons to help you choose the right solution.";

export const metadata: Metadata = {
  ...defaultMetadata,
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/compare",
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

export default function Page() {
  return (
    <section className="prose dark:prose-invert max-w-none">
      <h1>Compare openstatus with uptime and status page solutions</h1>
      <components.Grid cols={2}>
        {getComparePages().map((page) => (
          <ContentBoxLink key={page.slug} href={`/compare/${page.slug}`}>
            <ContentBoxTitle>{page.metadata.title}</ContentBoxTitle>
            <ContentBoxDescription>
              {page.metadata.description}
            </ContentBoxDescription>
            <ContentBoxUrl url="Read more" />
          </ContentBoxLink>
        ))}
      </components.Grid>
    </section>
  );
}
