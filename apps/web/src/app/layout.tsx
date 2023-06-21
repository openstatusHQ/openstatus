import "@/styles/globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import LocalFont from "next/font/local";
import PlausibleProvider from "next-plausible";
import Background from "./_components/background";
import { Toaster } from "@/components/ui/toaster";
import { Metadata } from "next";

const inter = Inter({ subsets: ["latin"] });

const calSans = LocalFont({
  src: "../public/fonts/CalSans-SemiBold.ttf",
  variable: "--font-calsans",
});

export const metadata: Metadata = {
  title: "openstatus.dev",
  description: "An Open Source Alternative for your next Status Page.",
  metadataBase: new URL("https://openstatus.dev"),
  twitter: {
    images: [`/api/og`],
    card: "summary_large_image",
    title: "openstatus.dev",
    description: "An Open Source Alternative for your next Status Page.",
  },
  openGraph: {
    type: "website",
    images: [`/api/og`],
    title: "openstatus.dev",
    description: "An Open Source Alternative for your next Status Page.",
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
