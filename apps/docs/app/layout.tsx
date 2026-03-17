import { RootProvider } from "fumadocs-ui/provider/next";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { OpenPanelComponent } from "@openpanel/nextjs";
import { source } from "@/lib/source";
import { baseOptions } from "@/lib/layout.shared";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import Script from "next/script";
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
