import type { Metadata } from "next";

import { components } from "../../../content/mdx";
import { playTools } from "../../../content/play-tools";
import { sections } from "../../../content/sections";
import { getListingMetadata } from "../../../lib/metadata/shared-metadata";
import {
  ContentBoxDescription,
  ContentBoxLink,
  ContentBoxTitle,
  ContentBoxUrl,
} from "../content-box";

export const metadata: Metadata = getListingMetadata(sections.play);

export default function Page() {
  return (
    <section className="prose dark:prose-invert max-w-none">
      <h1>{sections.play.label}</h1>
      <components.Grid cols={2}>
        {playTools.map((tool) => (
          <ContentBoxLink key={tool.href} href={tool.href}>
            <ContentBoxTitle>{tool.label}</ContentBoxTitle>
            <ContentBoxDescription>{tool.description}</ContentBoxDescription>
            <ContentBoxUrl url={tool.href} />
          </ContentBoxLink>
        ))}
      </components.Grid>
    </section>
  );
}
