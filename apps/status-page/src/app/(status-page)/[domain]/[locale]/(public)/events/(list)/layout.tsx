import type { Metadata } from "next";

import { statusPageAlternatesMetadata } from "@/lib/alternates-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ domain: string }>;
}): Promise<Metadata> {
  const { domain } = await params;
  return statusPageAlternatesMetadata({ domain, markdownPath: "/events.md" });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
