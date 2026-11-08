import type { Metadata } from "next";

import { components } from "../../../content/mdx";
import { getOssFriends } from "../../../content/oss-friends";
import { sections } from "../../../content/sections";
import { getListingMetadata } from "../../../lib/metadata/shared-metadata";
import {
  ContentBoxDescription,
  ContentBoxLink,
  ContentBoxTitle,
  ContentBoxUrl,
} from "../content-box";

export const metadata: Metadata = getListingMetadata(sections["oss-friends"]);

export default async function Page() {
  const openSourceFriends = await getOssFriends();
  return (
    <section className="prose dark:prose-invert max-w-none">
      <h1>{sections["oss-friends"].label}</h1>
      <components.Grid cols={2}>
        {openSourceFriends.map((friend) => (
          <ContentBoxLink key={friend.href} href={friend.href}>
            <ContentBoxTitle>{friend.name}</ContentBoxTitle>
            <ContentBoxDescription>{friend.description}</ContentBoxDescription>
            <ContentBoxUrl url={friend.href} />
          </ContentBoxLink>
        ))}
      </components.Grid>
    </section>
  );
}
