import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { Shell } from "@/components/dashboard/shell";
import { api } from "@/trpc/server";
import { Footer } from "./_components/footer";
import { Header } from "./_components/header";
import { setPrefixUrl } from "./utils";

type Props = {
  params: { domain: string };
  children: React.ReactNode;
};

export default async function StatusPageLayout({ children, params }: Props) {
  const page = await api.page.getPageBySlug.query({ slug: params.domain });
  if (!page) return notFound();

  const plan = page.workspacePlan;

  const navigation = [
    {
      label: "Status",
      segment: null,
      href: setPrefixUrl("/", params),
    },
    {
      label: "Incidents",
      segment: "incidents",
      href: setPrefixUrl("/incidents", params),
    },
    {
      label: "Monitors",
      segment: "monitors",
      href: setPrefixUrl("/monitors", params),
      disabled:
        page.monitors.filter((monitor) => Boolean(monitor.public)).length === 0,
    },
  ];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col space-y-6 p-4 md:p-8">
      <Header navigation={navigation} plan={plan} page={page} />
      <main className="flex h-full w-full flex-1 flex-col">
        <Shell className="mx-auto h-full flex-1 px-4 py-4">{children}</Shell>
      </main>
      <Footer plan={plan} />
    </div>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await api.page.getPageBySlug.query({ slug: params.domain });

  return {
    ...defaultMetadata,
    title: page?.title,
    description: page?.description,
    icons: page?.icon,
    twitter: {
      ...twitterMetadata,
      images: [`/api/og/page?slug=${page?.slug}`],
      title: page?.title,
      description: page?.description,
    },
    openGraph: {
      ...ogMetadata,
      images: [`/api/og/page?slug=${page?.slug}`],
      title: page?.title,
      description: page?.description,
    },
  };
}
