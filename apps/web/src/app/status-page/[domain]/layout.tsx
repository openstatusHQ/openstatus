import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { allPlans } from "@openstatus/plans";

import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { Shell } from "@/components/dashboard/shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { api } from "@/trpc/server";
import { Navbar } from "./_components/navbar";
import { SubscribeButton } from "./_components/subscribe-button";
import { setPrefixUrl } from "./utils";

type Props = {
  params: { domain: string };
  children: React.ReactNode;
};

export default async function StatusPageLayout({ children, params }: Props) {
  const page = await api.page.getPageBySlug.query({ slug: params.domain });
  if (!page) return notFound();

  const plan = page.workspacePlan;
  const isSubscribers = allPlans[plan].limits["status-subscribers"];
  const isWhiteLabel = allPlans[plan].limits["white-label"];

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
  ];

  return (
    <div className="flex min-h-screen w-full flex-col space-y-6 p-4 md:p-8">
      <header className="mx-auto w-full max-w-xl">
        <Shell className="mx-auto flex items-center justify-between gap-4 p-2 px-2 md:p-3">
          <div className="relative sm:w-[100px]">
            {page?.icon ? (
              <div className="bg-muted border-border flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border">
                <Image
                  height={28}
                  width={28}
                  src={page.icon}
                  alt={page.title}
                  className="object-cover"
                />
              </div>
            ) : null}
          </div>
          <Navbar navigation={navigation} />
          <div className="text-end sm:w-[100px]">
            {isSubscribers ? <SubscribeButton slug={params.domain} /> : null}
          </div>
        </Shell>
      </header>
      <main className="flex h-full w-full flex-1 flex-col">
        <Shell className="mx-auto h-full max-w-xl flex-1 px-4 py-4">
          {children}
        </Shell>
      </main>
      <footer className="z-10 mx-auto flex w-full max-w-xl items-center justify-between">
        <div />
        {!isWhiteLabel ? (
          <p className="text-muted-foreground text-center text-sm">
            powered by{" "}
            <a
              href="https://www.openstatus.dev"
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline underline-offset-4 hover:no-underline"
            >
              openstatus.dev
            </a>
          </p>
        ) : null}
        <ThemeToggle />
      </footer>
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
