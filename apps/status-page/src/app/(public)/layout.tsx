import { generateThemeStyles } from "@openstatus/theme-store";
import {
  SidebarInset,
  SidebarProvider,
} from "@openstatus/ui/components/ui/sidebar";
import { Toaster } from "@openstatus/ui/components/ui/sonner";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import PlausibleProvider from "next-plausible";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Link } from "../../components/common/link";
import { ThemeProvider } from "../../components/themes/theme-provider";
import {
  SidebarTrigger,
  ThemeSidebar,
} from "../../components/themes/theme-sidebar";
import {
  isCanonicalThemeExplorerHost,
  isThemeExplorerHost,
} from "../../lib/theme-explorer-host";
import { themeExplorerMetadata } from "../metadata";

const SIDEBAR_WIDTH = "20rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";

async function requestHost() {
  const headerStore = await headers();
  return headerStore.get("x-forwarded-host") ?? headerStore.get("host");
}

export async function generateMetadata(): Promise<Metadata> {
  const host = await requestHost();
  // Same gate as the layout: metadata is resolved alongside the render, so the
  // explorer's OG image would otherwise ship with the 404.
  if (!isThemeExplorerHost(host)) notFound();
  return themeExplorerMetadata({
    indexable: isCanonicalThemeExplorerHost(host),
  });
}

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  // `/` is the fallthrough for every host that resolves to no page, so keep the
  // explorer off unknown slugs and unconfigured custom domains.
  if (!isThemeExplorerHost(await requestHost())) notFound();

  const locale = "en";
  const messages = (await import(`../../../messages/${locale}.json`)).default;

  return (
    <PlausibleProvider domain="themes.openstatus.dev">
      <style
        id="theme-styles"
        // oxlint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: generateThemeStyles() }}
      />
      <NextIntlClientProvider locale={locale} messages={messages}>
        <ThemeProvider attribute="class" enableSystem disableTransitionOnChange>
          <SidebarProvider
            defaultOpen={true}
            style={
              {
                "--sidebar-width": SIDEBAR_WIDTH,
                "--sidebar-width-mobile": SIDEBAR_WIDTH_MOBILE,
              } as React.CSSProperties
            }
          >
            <SidebarInset className="relative">
              <SidebarTrigger className="absolute top-2 right-2" />
              <main className="mx-auto">{children}</main>
              <footer className="text-muted-foreground flex items-center justify-center gap-4 p-4 text-center font-mono text-sm">
                <p>
                  powered by{" "}
                  <Link href="https://openstatus.dev">openstatus</Link>
                </p>
              </footer>
            </SidebarInset>
            <Suspense>
              <ThemeSidebar />
            </Suspense>
          </SidebarProvider>
          <Toaster richColors expand />
        </ThemeProvider>
      </NextIntlClientProvider>
    </PlausibleProvider>
  );
}
