import { Footer } from "./footer";
import { Header } from "./header";
import { SubNav } from "./sub-nav";

export function ContentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 font-mono">
      <Header />
      <SubNav />
      <main className="flex-1 px-4 py-4">{children}</main>
      <Footer />
    </div>
  );
}
