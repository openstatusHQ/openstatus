import { defaultMetadata, ogMetadata, twitterMetadata } from "@/app/metadata";
import { Footer } from "@/components/nav/footer";
import { Header } from "@/components/nav/header";
import {
  FloatingButton,
  StatusPageProvider,
} from "@/components/status-page/floating-button";
import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export default function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ domain: string }>;
}) {
  return (
    <Hydrate params={params}>
      <StatusPageProvider>
        <div className="flex min-h-screen flex-col gap-4">
          <Header className="w-full border-b" />
          <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-3 py-2">
            {children}
          </main>
          <Footer className="w-full border-t" />
        </div>
        <FloatingButton />
      </StatusPageProvider>
    </Hydrate>
  );
}

async function Hydrate({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ domain: string }>;
}) {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(
    trpc.statusPage.get.queryOptions({ slug: (await params).domain }),
  );
  return <HydrateClient>{children}</HydrateClient>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ domain: string }>;
}): Promise<Metadata> {
  const queryClient = getQueryClient();
  const { domain } = await params;
  const page = await queryClient.fetchQuery(
    trpc.statusPage.get.queryOptions({ slug: domain }),
  );

  if (!page) return notFound();

  return {
    ...defaultMetadata,
    title: {
      template: `%s | ${page.title}`,
      default: page?.title,
    },
    description: page?.description,
    icons: page?.icon,
    alternates: {
      canonical: page?.customDomain
        ? `https://${page.customDomain}`
        : `https://${page.slug}.openstatus.dev`,
    },
    twitter: {
      ...twitterMetadata,
      images: [
        `/api/og/page?slug=${page?.slug}&passwordProtected=${page?.passwordProtected}`,
      ],
      title: page?.title,
      description: page?.description,
    },
    openGraph: {
      ...ogMetadata,
      images: [
        `/api/og/page?slug=${page?.slug}&passwordProtected=${page?.passwordProtected}`,
      ],
      title: page?.title,
      description: page?.description,
    },
  };
}
