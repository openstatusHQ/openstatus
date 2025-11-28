import { allChangelogs } from "content-collections";
import { Feed } from "feed";

export async function GET() {
  const feed = new Feed({
    id: "https://www.openstatus.dev/changelog",
    title: "OpenStatus - Changelog",
    description: "OpenStatus changelog feed",
    generator: "RSS for Node and Next.js",
    feedLinks: {
      rss: "https://www.openstatus.dev/changelog/feed.xml",
    },
    link: "https://www.openstatus.dev",
    author: {
      name: "OpenStatus Team",
      email: "ping@openstatus.dev",
      link: "https://openstatus.dev",
    },
    copyright: `Copyright ${new Date().getFullYear().toString()}, OpenStatus`,
    language: "en-US",
    updated: new Date(),
    ttl: 60,
  });

  allChangelogs
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
    .map((post) => {
      feed.addItem({
        id: `https://www.openstatus.dev/changelog/${post.slug}`,
        title: post.title,
        description: post.description,
        link: `https://www.openstatus.dev/changelog/${post.slug}`,
        author: [
          {
            name: "OpenStatus Team",
            email: "ping@openstatus.dev",
            link: "https://openstatus.dev",
          },
        ],
        date: post.publishedAt,
      });
    });
  return new Response(feed.rss2(), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
