import "../styles/globals.css";
import { OpenPanelComponent } from "@openpanel/nextjs";
import { Toaster } from "@openstatus/ui/components/ui/sonner";
import type { Metadata } from "next";
import PlausibleProvider from "next-plausible";
import { Inter } from "next/font/google";
import LocalFont from "next/font/local";
import Script from "next/script";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { ThemeProvider } from "../components/theme-provider";
import { WebMcpProvider } from "../components/webmcp-provider";
import { env } from "../env";
import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "../lib/metadata/shared-metadata";
import { TRPCReactQueryProvider } from "../trpc/rq-client";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const calSans = LocalFont({
  src: "../public/fonts/CalSans-SemiBold.ttf",
  variable: "--font-cal",
});

const commitMono = LocalFont({
  src: [
    {
      path: "../public/fonts/CommitMono-400-Regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/CommitMono-400-Italic.otf",
      weight: "400",
      style: "italic",
    },
    {
      path: "../public/fonts/CommitMono-700-Regular.otf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/fonts/CommitMono-700-Italic.otf",
      weight: "700",
      style: "italic",
    },
  ],
  variable: "--font-commit-mono",
});

export const metadata: Metadata = {
  ...defaultMetadata,
  twitter: {
    ...twitterMetadata,
  },
  openGraph: {
    ...ogMetadata,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${
          inter.className
        } ${inter.variable} ${calSans.variable} ${commitMono.variable} antialiased`}
      >
        <PlausibleProvider domain="openstatus.dev">
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <NuqsAdapter>
              <TRPCReactQueryProvider>{children}</TRPCReactQueryProvider>
              <WebMcpProvider />
            </NuqsAdapter>
          </ThemeProvider>
        </PlausibleProvider>
        {env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID && (
          <OpenPanelComponent
            clientId={env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID}
            trackScreenViews
            trackOutgoingLinks
            trackAttributes
          />
        )}
        <Toaster
          toastOptions={{
            classNames: {
              toast:
                "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg rounded-none!",
              description: "group-[.toast]:text-muted-foreground",
              actionButton:
                "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground rounded-none!",
              cancelButton:
                "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
              closeButton: "group-[.toast]:text-muted-foreground",
            },
          }}
          icons={{
            success: null,
            error: null,
            warning: null,
            info: null,
            loading: null,
          }}
          richColors
        />
        <Script src="https://ui.sh/ui-picker.js" />
      </body>
    </html>
  );
}
