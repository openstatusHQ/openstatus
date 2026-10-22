import type { Metadata } from "next";
import { z } from "zod";

import { components } from "../../../content/mdx";
import { sections } from "../../../content/sections";
import { getListingMetadata } from "../../../lib/metadata/shared-metadata";
import {
  ContentBoxDescription,
  ContentBoxLink,
  ContentBoxTitle,
  ContentBoxUrl,
} from "../content-box";

export const metadata: Metadata = getListingMetadata(sections["oss-friends"]);

const OSSFriendSchema = z.object({
  href: z.string(),
  name: z.string(),
  description: z.string(),
});

export default async function Page() {
  const res = await fetch("https://formbricks.com/api/oss-friends");
  const data = await res.json();
  const openSourceFriends = z.array(OSSFriendSchema).parse(data.data);
  return (
    <section className="prose dark:prose-invert max-w-none">
      <h1>OSS Friends</h1>
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
