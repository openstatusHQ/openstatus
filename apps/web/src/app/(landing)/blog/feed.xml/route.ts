import { allPosts } from "content-collections";
import { Feed } from "feed";

export async function GET() {
  const feed = new Feed({
    id: "https://www.openstatus.dev/blog",
    title: "OpenStatus - Blog",
    description: "OpenStatus blog feed",
    generator: "RSS for Node and Next.js",
    feedLinks: {
      rss: "https://www.openstatus.dev/blog/feed.xml",
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

  allPosts
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
    .map((post) => {
      feed.addItem({
        id: `https://www.openstatus.dev/blog/${post.slug}`,
        title: post.title,
        description: post.description,
        link: `https://www.openstatus.dev/blog/${post.slug}`,
        author: [
          {
            name: post.author.name,
            link: post.author.url,
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
