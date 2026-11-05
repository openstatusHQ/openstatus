import { z } from "zod";

import { canonicalUrl, frontmatter } from "./frontmatter";
import { sections } from "./sections";

const OSSFriendSchema = z.object({
  href: z.url(),
  name: z.string(),
  description: z.string(),
});

export type OSSFriend = z.infer<typeof OSSFriendSchema>;

export async function getOssFriends(): Promise<OSSFriend[]> {
  const res = await fetch("https://formbricks.com/api/oss-friends");
  if (!res.ok) throw new Error(`oss-friends fetch failed: ${res.status}`);
  const data = await res.json();
  return z.array(OSSFriendSchema).parse(data.data);
}

// Remote strings land in a markdown list: brackets would close the link, line
// breaks would start a new item and a stray backslash would undo the escape.
function mdText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/[\\[\]]/g, "\\$&")
    .trim();
}

function mdHref(href: string): string {
  return href.replace(
    /[()\s]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function renderOssFriendsMarkdown(friends: OSSFriend[]): string {
  const section = sections["oss-friends"];
  const items = friends
    .map(
      (f) =>
        `- [${mdText(f.name)}](${mdHref(f.href)}): ${mdText(f.description)}`,
    )
    .join("\n");
  return `${frontmatter({
    title: section.title,
    url: canonicalUrl(section.path),
    description: section.description,
  })}# ${section.label}\n\n${section.description}\n\n${items}\n`;
}

// Markdown twin of /oss-friends; remote data, so it can't go through the
// synchronous listing generator.
export async function generateOssFriendsMarkdown(): Promise<string> {
  return renderOssFriendsMarkdown(await getOssFriends());
}
