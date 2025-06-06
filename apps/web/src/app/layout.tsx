import "@/styles/globals.css";

import { Toaster } from "@/components/ui/sonner";
import { OpenPanelComponent } from "@openpanel/nextjs";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import LocalFont from "next/font/local";

import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { TailwindIndicator } from "@/components/tailwind-indicator";
import { ThemeProvider } from "@/components/theme-provider";
import { env } from "@/env";
import { TRPCReactQueryProvider } from "@/trpc/rq-client";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import Background from "./_components/background";

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
        <NuqsAdapter>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <TRPCReactQueryProvider>
              <Background>{children}</Background>
              <Toaster richColors closeButton />
              <TailwindIndicator />
            </TRPCReactQueryProvider>
          </ThemeProvider>
        </NuqsAdapter>
        {env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID && (
          <OpenPanelComponent
            clientId={env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID}
            trackScreenViews
            trackOutgoingLinks
            trackAttributes
          />
        )}
      </body>
    </html>
  );
}
