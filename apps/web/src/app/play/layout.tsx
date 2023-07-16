import * as React from "react";
import type { Metadata } from "next";

import { BackButton } from "@/components/layout/back-button";
import { Footer } from "@/components/layout/footer";

export const metadata: Metadata = {
  twitter: {
    images: [`/api/og?siteId=openstatus`],
  },
  openGraph: {
    images: [`/api/og?siteId=openstatu`],
  },
};

export default function PlayLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <main className="container mx-auto flex min-h-screen w-full flex-col items-center justify-center space-y-6 p-4 md:p-8">
      <div className="z-10 flex w-full flex-1 flex-col items-start justify-center">
        <BackButton />
        <div className="border-border w-full rounded-lg border p-3 backdrop-blur-[2px] md:p-6">
          {children}
          {modal}
        </div>
      </div>
      <Footer />
    </main>
  );
}
