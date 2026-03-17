import type { MetadataRoute } from "next";
import { source } from "@/lib/source";

const BASE_URL = "https://docs.openstatus.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  return source.getPages().map((page) => ({
    url: page.url === "/" ? BASE_URL : `${BASE_URL}${page.url}/`,
  }));
}
