import { defaultMetadata, ogMetadata, twitterMetadata } from "@/app/metadata";
import { PasswordWrapper } from "@/components/password-wrapper";
import {
  FloatingButton,
  StatusPageProvider,
} from "@/components/status-page/floating-button";
import { FloatingTheme } from "@/components/status-page/floating-theme";
import { ThemeProvider } from "@/components/themes/theme-provider";
import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";
import { pageConfigurationSchema } from "@openstatus/db/src/schema";
import { generateThemeStyles } from "@openstatus/theme-store";
import { Toaster } from "@openstatus/ui/components/ui/sonner";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

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
        // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
        dangerouslySetInnerHTML={{
          __html: generateThemeStyles(cfg.theme),
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
          defaultCommunityTheme={cfg.theme}
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
    alternates: {
      canonical: page?.customDomain
        ? `https://${page.customDomain}`
        : `https://${page.slug}.openstatus.dev`,
    },
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
