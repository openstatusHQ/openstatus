import { allPosts } from "contentlayer/generated";
import { Rss } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@openstatus/ui";

import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { Timeline } from "@/components/content/timeline";
import { Shell } from "@/components/dashboard/shell";
import Blog from "./Blog";

export const metadata: Metadata = {
  ...defaultMetadata,
  title: "Blog",
  openGraph: {
    ...ogMetadata,
    title: "Blog | OpenStatus",
  },
  twitter: {
    ...twitterMetadata,
    title: "Blog | OpenStatus",
  },
};

export default async function Post() {

  return (
    <Shell>
      <Blog/>
    </Shell>
  );
}
