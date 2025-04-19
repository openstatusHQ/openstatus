import { alternativesConfig } from "@/config/alternatives";
import { landingsConfig } from "@/config/landings";
import { allChangelogs, allPosts } from "content-collections";
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

  const comparisons = Object.keys(alternativesConfig).map((slug) => ({
    url: `https://www.openstatus.dev/compare/${slug}`,
    lastModified: new Date(),
  }));

  const landings = Object.keys(landingsConfig).map((slug) => ({
    url: `https://www.openstatus.dev/${slug}`,
    lastModified: new Date(),
  }));

  const routes = [
    "/",
    "/about",
    "/app/login",
    "/blog",
    "/changelog",
    "/play",
    "/play/checker",
    "/play/curl",
    "/pricing",
    "/oss-friends",
  ].map((route) => ({
    url: addPathToBaseURL(route),
    lastModified: new Date(),
  }));

  return [...routes, ...blogs, ...changelogs, ...comparisons, ...landings];
}
