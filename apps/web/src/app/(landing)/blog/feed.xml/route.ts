import { getBlogPosts } from "@/content/utils";
import { Feed } from "feed";
import { getAuthor } from "src/data/author";

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

  const allPosts = getBlogPosts();

  allPosts
    .sort(
      (a, b) =>
        new Date(b.metadata.publishedAt).getTime() -
        new Date(a.metadata.publishedAt).getTime(),
    )
    .map((post) => {
      const author = getAuthor(post.metadata.author);
      return feed.addItem({
        id: `https://www.openstatus.dev/blog/${post.slug}`,
        title: post.metadata.title,
        description: post.metadata.description,
        link: `https://www.openstatus.dev/blog/${post.slug}`,
        author: [
          typeof author === "string"
            ? { name: author }
            : {
                name: author.name,
                link: author.url,
              },
        ],
        image: post.metadata.image
          ? `https://www.openstatus.dev${post.metadata.image}`
          : undefined,
        date: post.metadata.publishedAt,
      });
    });
  return new Response(feed.rss2(), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
