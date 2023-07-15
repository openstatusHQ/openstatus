import type { MetadataRoute } from "next";

const addPathToBaseURL = (path: string) => `https://openstatus.dev${path}`;

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: addPathToBaseURL("/"),
      lastModified: new Date(),
    },
    {
      url: addPathToBaseURL("/play"),
      lastModified: new Date(),
    },
    {
      url: addPathToBaseURL("/app/sign-in"),
      lastModified: new Date(),
    },
    {
      url: addPathToBaseURL("/app/sign-up"),
      lastModified: new Date(),
    },
    {
      url: addPathToBaseURL("/monitor/openstatus"),
      lastModified: new Date(),
    },
  ];
}
