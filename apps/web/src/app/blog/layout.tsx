import * as React from "react";

import { Shell } from "@/components/dashboard/shell";
import { BackButton } from "@/components/layout/back-button";
import { Footer } from "@/components/layout/footer";

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="container mx-auto flex min-h-screen w-full flex-col items-center justify-center space-y-6 p-4 md:p-8">
      <div className="z-10 flex w-full flex-1 flex-col items-start justify-center">
        <div className="mx-auto w-full max-w-prose">
          <BackButton />
        </div>
        <Shell className="mx-auto w-full max-w-prose">{children}</Shell>
      </div>
      <Footer />
    </main>
  );
}
