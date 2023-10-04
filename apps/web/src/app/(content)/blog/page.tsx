import { allPosts } from "contentlayer/generated";

import { Thumbnail } from "@/components/content/thumbnail";
import { Shell } from "@/components/dashboard/shell";

export default async function Post() {
  const posts = allPosts.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  return (
    <Shell>
      <div className="grid gap-8">
        <h1 className="text-foreground font-cal text-4xl">Blog</h1>
        <div className="space-y-4">
          {posts.map((post) => (
            <Thumbnail key={post._id} post={post} />
          ))}
        </div>
      </div>
    </Shell>
  );
}
