import { defaultMetadata, ogMetadata, twitterMetadata } from "@/app/metadata";
import {
  FloatingButton,
  StatusPageProvider,
} from "@/components/status-page/floating-button";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

export const schema = z.object({
  card: z.enum(["duration", "requests", "manual"]).default("duration"),
  bar: z.enum(["absolute", "manual"]).default("absolute"),
  uptime: z.boolean().default(true),
  theme: z.enum(["default"]).default("default"),
});

const DISPLAY_FLOATING_BUTTON =
  process.env.NODE_ENV === "development" ||
  process.env.ENABLE_FLOATING_BUTTON === "true";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ domain: string }>;
}) {
  const queryClient = getQueryClient();
  const { domain } = await params;
  const page = await queryClient.fetchQuery(
    trpc.statusPage.get.queryOptions({ slug: domain }),
  );

  const validation = schema.safeParse(page?.configuration);

  return (
    <HydrateClient>
      <ThemeProvider
        attribute="class"
        defaultTheme={page?.forceTheme ?? "system"}
        enableSystem
        disableTransitionOnChange
      >
        <StatusPageProvider
          defaultBarType={validation.data?.bar}
          defaultCardType={validation.data?.card}
          defaultShowUptime={validation.data?.uptime}
          defaultCommunityTheme={validation.data?.theme}
        >
          {children}
          {DISPLAY_FLOATING_BUTTON ? <FloatingButton /> : null}
          <Toaster richColors expand />
        </StatusPageProvider>
      </ThemeProvider>
    </HydrateClient>
  );
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
