import * as React from "react";

import { Footer } from "@/components/layout/footer";

// same layout as /play
export default function MonitorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="container mx-auto flex min-h-screen w-full flex-col items-center justify-center space-y-6 p-4 md:p-8">
      <div className="flex w-full flex-1 items-center justify-center">
        <div className="border-border z-10 w-full max-w-min rounded-lg border p-3 backdrop-blur-[2px] md:p-6">
          {children}
        </div>
      </div>
      <Footer />
    </main>
  );
}
