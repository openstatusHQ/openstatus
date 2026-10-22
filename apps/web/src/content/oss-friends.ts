import { z } from "zod";

import { canonicalUrl, frontmatter } from "./frontmatter";
import { sections } from "./sections";

const OSSFriendSchema = z.object({
  href: z.string(),
  name: z.string(),
  description: z.string(),
});

export type OSSFriend = z.infer<typeof OSSFriendSchema>;

export async function getOssFriends(): Promise<OSSFriend[]> {
  const res = await fetch("https://formbricks.com/api/oss-friends");
  const data = await res.json();
  return z.array(OSSFriendSchema).parse(data.data);
}

// Markdown twin of /oss-friends; remote data, so it can't go through the
// synchronous listing generator.
export async function generateOssFriendsMarkdown(): Promise<string> {
  const friends = await getOssFriends();
  const section = sections["oss-friends"];
  const items = friends
    .map((f) => `- [${f.name}](${f.href}): ${f.description}`)
    .join("\n");
  return `${frontmatter({
    title: section.title,
    url: canonicalUrl(section.path),
    description: section.description,
  })}# ${section.label}\n\n${section.description}\n\n${items}\n`;
}
