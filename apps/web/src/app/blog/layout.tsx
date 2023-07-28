import * as React from "react";

import { Footer } from "@/components/layout/footer";
import { MarketingHeader } from "@/components/layout/marketing-header";

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="container mx-auto flex min-h-screen w-full flex-col items-center justify-center space-y-6 p-4 md:p-8">
      <MarketingHeader className="mx-auto w-full max-w-[calc(65ch+8rem)]" />
      <div className="z-10 flex w-full flex-1 flex-col items-start justify-center">
        <div className="mx-auto w-full max-w-[calc(65ch+8rem)]">{children}</div>
      </div>
      <Footer />
    </main>
  );
}
