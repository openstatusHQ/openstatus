import "@/styles/globals.css";

import { OpenPanelComponent } from "@openpanel/nextjs";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import LocalFont from "next/font/local";

import { ThemeProvider } from "@/components/theme-provider";
import { env } from "@/env";
import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/lib/metadata/shared-metadata";
import { TRPCReactQueryProvider } from "@/trpc/rq-client";
import { Toaster } from "@openstatus/ui/components/ui/sonner";
import PlausibleProvider from "next-plausible";
import { NuqsAdapter } from "nuqs/adapters/next/app";

const inter = Inter({ subsets: ["latin"] });

const calSans = LocalFont({
  src: "../public/fonts/CalSans-SemiBold.ttf",
  variable: "--font-cal",
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
          // biome-ignore lint/nursery/useSortedClasses: <explanation>
        } ${calSans.variable}`}
      >
        <PlausibleProvider domain="openstatus.dev">
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <NuqsAdapter>
              <TRPCReactQueryProvider>{children}</TRPCReactQueryProvider>
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
        />
      </body>
    </html>
  );
}
