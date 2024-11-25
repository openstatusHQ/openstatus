import { allPosts } from "content-collections";
import RSS from "rss";

export async function GET() {
  const feed = new RSS({
    title: "OpenStatus",
    description: "OpenStatus blog feed",
    generator: "RSS for Node and Next.js",
    feed_url: "https://www.openstatus.dev/blog/feed.xml",
    site_url: "https://www.openstatus.dev",
    managingEditor: "ping@openstatus.dev (OpenStatus Team)",
    webMaster: "ping@openstatus.dev (OpenStatus Team)",
    copyright: `Copyright ${new Date().getFullYear().toString()}, OpenStatus`,
    language: "en-US",
    pubDate: new Date().toUTCString(),
    ttl: 60,
  });

  allPosts
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
    .map((post) => {
      feed.item({
        title: post.title,
        description: post.description,
        url: `https://www.openstatus.dev/blog/${post.slug}`,
        author: post.author.name,
        date: post.publishedAt,
      });
    });
  return new Response(feed.xml({ indent: true }), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
