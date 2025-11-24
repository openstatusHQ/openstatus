import { Footer } from "@/components/nav/footer";
import { Header } from "@/components/nav/header";
import { Suspense } from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <div className="flex min-h-screen flex-col gap-4">
        <Header className="w-full border-b" />
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-3 py-2">
          {children}
        </main>
        <Footer className="w-full border-t" />
      </div>
    </Suspense>
  );
}
