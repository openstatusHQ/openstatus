import { Footer } from "@/components/nav/footer";
import {
  FloatingButton,
  StatusPageProvider,
} from "@/components/status-page/floating-button";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <StatusPageProvider>
      <div className="flex min-h-screen flex-col gap-4">
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-3 py-2">
          {children}
        </main>
        <Footer className="w-full border-t" />
      </div>
      <FloatingButton />
    </StatusPageProvider>
  );
}
