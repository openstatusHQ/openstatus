import * as React from "react";

import { AppHeader } from "@/components/layout/app-header";
import { AppMenu } from "@/components/layout/app-menu";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Footer } from "@/components/layout/footer";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container mx-auto flex min-h-screen w-full flex-col items-center justify-center space-y-6 p-4 md:p-8">
      <AppHeader />
      <div className="flex w-full flex-1 gap-6 md:gap-8">
        <aside className="border-border hidden rounded-lg border p-3 backdrop-blur-[2px] md:block md:p-6">
          <nav>
            <AppSidebar />
          </nav>
        </aside>
        <main className="z-10 flex w-full flex-1 flex-col items-start justify-center">
          <div className="border-border relative w-full flex-1 rounded-lg border p-3 backdrop-blur-[2px] md:p-6">
            <nav className="absolute right-4 top-4 block md:hidden">
              <AppMenu />
            </nav>
            {children}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
