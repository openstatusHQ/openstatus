import { Shell } from "@/components/dashboard/shell";
import { AppHeader } from "@/components/layout/header/app-header";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="container relative mx-auto flex min-h-screen w-full flex-col items-center justify-center gap-6 p-4 lg:p-8">
      <AppHeader />
      <div className="flex w-full flex-1 gap-6 lg:gap-8">
        <main className="z-10 flex w-full flex-1 flex-col items-start justify-center">
          <Shell className="relative flex-1">{children}</Shell>
        </main>
      </div>
    </div>
  );
}
