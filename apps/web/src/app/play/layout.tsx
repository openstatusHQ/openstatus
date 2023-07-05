import * as React from "react";

import { Footer } from "@/components/layout/footer";

export default function PlayLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <main className="container mx-auto flex min-h-screen w-full flex-col items-center justify-center space-y-6 p-4 md:p-8">
      <div className="flex w-full flex-1 items-center justify-center">
        <div className="border-border z-10 w-full rounded-lg border p-3 backdrop-blur-[2px] md:p-6">
          {children}
          {modal}
        </div>
      </div>
      <Footer />
    </main>
  );
}
