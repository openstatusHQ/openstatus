import * as React from "react";

import { BackButton } from "@/components/layout/back-button";
import { Footer } from "@/components/layout/footer";
import { MarketingHeader } from "@/components/layout/marketing-header";

// same layout as /play
export default function MonitorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center space-y-6 p-4 md:p-8">
      <MarketingHeader className="mx-auto max-w-[calc(65ch+8rem)]" />
      <div className="z-10 mx-auto flex w-full max-w-[calc(65ch+8rem)] flex-1 flex-col items-start justify-center">
        <BackButton href="/play" />
        <div className="border-border w-full rounded-lg border p-3 backdrop-blur-[2px] md:p-6">
          {children}
        </div>
      </div>
      <Footer />
    </div>
  );
}
