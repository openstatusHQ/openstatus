import type { MetadataRoute } from "next";
import { allChangelogs, allPosts } from "contentlayer/generated";

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
    "/blog",
    "/changelog",
    "/app/sign-in",
    "/app/sign-up",
    "/monitor/openstatus",
  ].map((route) => ({
    url: addPathToBaseURL(route),
    lastModified: new Date(),
  }));

  return [...routes, ...blogs, ...changelogs];
}
