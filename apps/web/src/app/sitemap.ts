import { allChangelogs, allPosts } from "contentlayer/generated";
import type { MetadataRoute } from "next";

const addPathToBaseURL = (path: string) => `https://www.openstatus.dev${path}`;

export default function sitemap(): MetadataRoute.Sitemap {
  const blogs = allPosts.map((post) => ({
    url: `https://www.openstatus.dev/blog/${post.slug}`,
    lastModified: post.publishedAt, // date format should be YYYY-MM-DD
  }));

  const changelogs = allChangelogs.map((post) => ({
    url: `https://www.openstatus.dev/changelog/${post.slug}`,
    lastModified: post.publishedAt, // date format should be YYYY-MM
  }));

  const routes = [
    "/",
    "/play",
    "/play/checker",
    "/oss-friends",
    "/pricing",
    "/about",
    "/blog",
    "/changelog",
    "/app/login",
  ].map((route) => ({
    url: addPathToBaseURL(route),
    lastModified: new Date(),
  }));

  return [...routes, ...blogs, ...changelogs];
}
