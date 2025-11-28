import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { components } from "@/content/mdx";
import { getComparePages } from "@/content/utils";
import type { Metadata } from "next";
import {
  ContentBoxDescription,
  ContentBoxLink,
  ContentBoxTitle,
  ContentBoxUrl,
} from "../content-box";

const TITLE = "Compare Alternatives";
const DESCRIPTION = "Compare OpenStatus with other tools.";

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
