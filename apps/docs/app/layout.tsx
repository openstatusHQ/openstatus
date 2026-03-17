import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";
import { OpenPanelComponent } from "@openpanel/nextjs";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import Script from "next/script";
import type { ReactNode } from "react";
import "./global.css";

export const metadata: Metadata = {
  title: {
    default: "OpenStatus Docs",
    template: "%s | OpenStatus Docs",
  },
  description:
    "OpenStatus documentation — learn how to create your open-source status page, monitor your websites and APIs from 35+ global locations, and configure alerts.",
  metadataBase: new URL("https://docs.openstatus.dev"),
  openGraph: {
    siteName: "OpenStatus Docs",
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          defer
          data-domain="docs.openstatus.dev"
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
      </head>
      <body className="flex min-h-screen flex-col">
        <RootProvider>
          <DocsLayout tree={source.getPageTree()} {...baseOptions()}>
            {children}
          </DocsLayout>
        </RootProvider>
        {process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID && (
          <OpenPanelComponent
            clientId={process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID}
            trackScreenViews
            trackOutgoingLinks
            trackAttributes
          />
        )}
      </body>
    </html>
  );
}
