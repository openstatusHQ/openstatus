import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { TailwindIndicator } from "@/components/tailwind-indicator";
import { ThemeProvider } from "@/components/theme-provider";
import { auth } from "@/lib/auth";
import { TRPCReactProvider } from "@/lib/trpc/client";
import { OpenPanelComponent } from "@openpanel/nextjs";
import { Toaster } from "@openstatus/ui/components/ui/sonner";
import { cn } from "@openstatus/ui/lib/utils";
import { SessionProvider } from "next-auth/react";
import LocalFont from "next/font/local";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ogMetadata, twitterMetadata } from "./metadata";
import { defaultMetadata } from "./metadata";

const cal = LocalFont({
  src: "../../public/fonts/CalSans-SemiBold.ttf",
  variable: "--font-cal-sans",
});

const commitMono = LocalFont({
  src: [
    {
      path: "../../public/fonts/CommitMono-400-Regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/CommitMono-400-Italic.otf",
      weight: "400",
      style: "italic",
    },
    {
      path: "../../public/fonts/CommitMono-700-Regular.otf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../public/fonts/CommitMono-700-Italic.otf",
      weight: "700",
      style: "italic",
    },
  ],
  variable: "--font-commit-mono",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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

// export const dynamic = "error";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          geistSans.variable,
          geistMono.variable,
          cal.variable,
          commitMono.variable,
          inter.variable,
          "font-sans antialiased ",
        )}
      >
        <SessionProvider session={session}>
          <TRPCReactProvider>
            <NuqsAdapter>
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
              >
                {children}
                <TailwindIndicator />
                <Toaster richColors expand />
                {process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID && (
                  <OpenPanelComponent
                    clientId={process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID}
                    trackScreenViews
                    trackOutgoingLinks
                    trackAttributes
                    sessionReplay={{ enabled: true }}
                  />
                )}
              </ThemeProvider>
            </NuqsAdapter>
          </TRPCReactProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
