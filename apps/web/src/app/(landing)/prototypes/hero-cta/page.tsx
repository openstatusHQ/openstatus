import type { Metadata } from "next";

import { Demo } from "@/content/mdx-components/demo";
import { getHomePage } from "@/content/utils";

import { Harness } from "./harness";

export const metadata: Metadata = {
  title: "Prototype: hero CTA",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ v?: string }>;
}) {
  const { v } = await searchParams;
  const home = getHomePage();
  return (
    <Harness
      title={home.metadata.title}
      hero={home.metadata.hero ?? home.metadata.title}
      description={home.metadata.description}
      initial={Number(v) || 1}
      demo={<Demo type="status-page" />}
    />
  );
}
