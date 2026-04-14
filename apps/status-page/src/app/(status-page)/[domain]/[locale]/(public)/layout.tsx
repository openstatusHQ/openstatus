import { IframeShell } from "@/components/layout/iframe-shell";
import { Footer } from "@/components/nav/footer";
import { Header } from "@/components/nav/header";
import { cn } from "@openstatus/ui/lib/utils";
import { Suspense } from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <IframeShell
        className={cn(
          "flex min-h-screen flex-col gap-4",
          "group-data-[iframe=true]/iframe:min-h-0",
        )}
      >
        <Header className="w-full border-b" />
        <main
          className={cn(
            "mx-auto flex w-full max-w-2xl flex-1 flex-col px-3 py-2",
            "group-data-[iframe=true]/iframe:mx-0 group-data-[iframe=true]/iframe:max-w-none",
          )}
        >
          {children}
        </main>
        <Footer className="w-full border-t" />
      </IframeShell>
    </Suspense>
  );
}
