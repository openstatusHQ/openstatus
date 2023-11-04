import "@/styles/globals.css";

import type { Metadata } from "next";
import LocalFont from "next/font/local";
import { GeistMono, GeistSans } from "geist/font";
import PlausibleProvider from "next-plausible";

import { Toaster } from "@openstatus/ui";

import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { TailwindIndicator } from "@/components/tailwind-indicator";
import Background from "./_components/background";

const calSans = LocalFont({
  src: "../public/fonts/CalSans-SemiBold.ttf",
  variable: "--font-calsans",
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
    <html lang="en">
      {/* TODO: remove plausible from root layout (to avoid tracking subdomains) */}
      <PlausibleProvider domain="openstatus.dev">
        <body
          className={`${GeistMono.variable} ${GeistSans.variable} ${calSans.variable} font-sans`}
        >
          <Background>{children}</Background>
          <Toaster />
          <TailwindIndicator />
        </body>
      </PlausibleProvider>
    </html>
  );
}
