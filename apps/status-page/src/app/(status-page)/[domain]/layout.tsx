import { pageConfigurationSchema } from "@openstatus/db/src/schema";
import { generatePageStyles } from "@openstatus/theme-store";
import { Toaster } from "@openstatus/ui/components/ui/sonner";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PasswordWrapper } from "../../../components/password-wrapper";
import {
  FloatingButton,
  StatusPageProvider,
} from "../../../components/status-page/floating-button";
import { FloatingTheme } from "../../../components/status-page/floating-theme";
import { ThemeProvider } from "../../../components/themes/theme-provider";
import { statusPageAlternates } from "../../../lib/alternates";
import { getQueryClient, HydrateClient, trpc } from "../../../lib/trpc/server";
import { defaultMetadata, ogMetadata, twitterMetadata } from "../../metadata";

// Canonical schema — guarantees concrete enum output (never null/undefined).

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

  if (!page) return notFound();

  // safeParse + fallback so a stale enum value in stored config (e.g. removed
  // theme key) doesn't crash the layout.
  const cfgResult = pageConfigurationSchema.safeParse(
    page?.configuration ?? {},
  );
  const cfg = cfgResult.success
    ? cfgResult.data
    : pageConfigurationSchema.parse({});

  return (
    <HydrateClient>
      <style
        id="theme-styles"
        // custom theme vars (already plan-gated + validated server-side) are
        // merged over the selected theme: custom-theme > theme
        // oxlint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: generatePageStyles({
            themeKey: cfg.theme,
            customTheme: page.customTheme,
          }),
        }}
      />
      <ThemeProvider
        attribute="class"
        defaultTheme={page?.forceTheme ?? "system"}
        enableSystem
        disableTransitionOnChange
      >
        <StatusPageProvider
          defaultBarType={cfg.type}
          defaultCardType={cfg.value}
          defaultShowUptime={cfg.uptime}
          defaultNumberOfDays={cfg.days}
          defaultCommunityTheme={cfg.theme}
          customTheme={page.customTheme}
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
          <PasswordWrapper />
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
    robots: page?.allowIndex
      ? { index: true, follow: true }
      : { index: false, follow: false },
    icons: page?.icon?.toLowerCase().endsWith(".svg")
      ? { icon: { url: page.icon, type: "image/svg+xml" } }
      : page?.icon,
    alternates: statusPageAlternates({
      slug: page.slug,
      customDomain: page.customDomain,
    }),
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
