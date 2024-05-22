import "@/styles/globals.css";

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import LocalFont from "next/font/local";

import { OpenStatusProvider } from "@openstatus/next-monitoring";
import { Toaster } from "@openstatus/ui";

import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { TailwindIndicator } from "@/components/tailwind-indicator";
import { ThemeProvider } from "@/components/theme-provider";
import Background from "./_components/background";

const inter = Inter({ subsets: ["latin"] });

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
      <body className={`${inter.className}${calSans.variable}`}>
        {/* Only include RUM in prod */}
        {process.env.NODE_ENV === "production" && (
          <OpenStatusProvider dsn="openstatus" />
        )}
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <Background>{children}</Background>
          <Toaster richColors />
          <TailwindIndicator />
        </ThemeProvider>
      </body>
    </html>
  );
}
