import { DocsMobileNav, DocsSidebar } from "@/content/docs-sidebar";
import { Footer } from "@/content/footer";
import { Header } from "@/content/header";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 font-mono">
      <Header />
      <div className="flex flex-1 gap-8 px-4 py-4">
        <DocsSidebar className="hidden w-56 shrink-0 lg:block" />
        <main className="min-w-0 flex-1">
          <DocsMobileNav className="lg:hidden" />
          {children}
        </main>
      </div>
      <Footer />
    </div>
  );
}
