import { Footer } from "@/content/footer";
import { Header } from "@/content/header";
import { SubNav } from "@/content/sub-nav";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 font-mono">
      <Header />
      <SubNav />
      <main className="flex-1 px-4 py-4">{children}</main>
      <Footer />
    </div>
  );
}
