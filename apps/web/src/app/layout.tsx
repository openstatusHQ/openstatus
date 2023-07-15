import "@/styles/globals.css";

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import LocalFont from "next/font/local";
import { ClerkProvider } from "@clerk/nextjs";
import PlausibleProvider from "next-plausible";

import { Toaster } from "@/components/ui/toaster";
import Background from "./_components/background";

const inter = Inter({ subsets: ["latin"] });

const calSans = LocalFont({
  src: "../public/fonts/CalSans-SemiBold.ttf",
  variable: "--font-calsans",
});

const TITLE = "OpenStatus";
const DESCRIPTION =
  "Open-Source alternative to your current monitoring service with beautiful status page";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL("https://openstatus.dev"),
  twitter: {
    images: [`/api/og`],
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  openGraph: {
    type: "website",
    images: [`/api/og`],
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <PlausibleProvider domain="openstatus.dev">
          <body className={`${inter.className} ${calSans.variable}`}>
            <Background>{children}</Background>
            <Toaster />
          </body>
        </PlausibleProvider>
      </html>
    </ClerkProvider>
  );
}
