import { defaultMetadata, ogMetadata, twitterMetadata } from "@/app/metadata";
import {
  FloatingButton,
  StatusPageProvider,
} from "@/components/status-page/floating-button";
import { FloatingTheme } from "@/components/status-page/floating-theme";
import { ThemeProvider } from "@/components/themes/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";
import {
  THEME_KEYS,
  type ThemeKey,
  generateThemeStyles,
} from "@openstatus/theme-store";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

export const schema = z.object({
  value: z.enum(["duration", "requests", "manual"]).default("duration"),
  type: z.enum(["absolute", "manual"]).default("absolute"),
  uptime: z.coerce.boolean().default(true),
  theme: z.enum(THEME_KEYS as [ThemeKey, ...ThemeKey[]]).default("default"),
});

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
  const communityTheme = validation.data?.theme;

  return (
    <HydrateClient>
      <style
        id="theme-styles"
        dangerouslySetInnerHTML={{
          __html: generateThemeStyles(communityTheme),
        }}
      />
      <ThemeProvider
        attribute="class"
        defaultTheme={page?.forceTheme ?? "system"}
        enableSystem
        disableTransitionOnChange
      >
        <StatusPageProvider
          defaultBarType={validation.data?.type}
          defaultCardType={validation.data?.value}
          defaultShowUptime={validation.data?.uptime}
          defaultCommunityTheme={validation.data?.theme}
        >
          {children}
          <FloatingButton
            pageId={page?.id}
            // NOTE: token to avoid showing the floating button to random users
            // timestamp is our token - it is hard to guess
            token={page?.createdAt?.getTime().toString()}
          />
          <FloatingTheme />
          <Toaster
            toastOptions={{
              classNames: {},
              style: { borderRadius: "var(--radius-lg)" },
            }}
            richColors
            expand
          />
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
