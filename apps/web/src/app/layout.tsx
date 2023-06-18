import "@/styles/globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import LocalFont from "next/font/local";

import PlausibleProvider from "next-plausible";
import Background from "./components/background";

const inter = Inter({ subsets: ["latin"] });

const calSans = LocalFont({
  src: "../public/fonts/CalSans-SemiBold.ttf",
  variable: "--font-calsans",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <ClerkProvider>
        <PlausibleProvider domain="openstatus.dev">
          <body className={`${inter.className} ${calSans.variable}`}>
            <Background>{children}</Background>
          </body>
        </PlausibleProvider>
      </ClerkProvider>
    </html>
  );
}
