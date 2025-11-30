import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { Footer } from "@/content/footer";
import { Header } from "@/content/header";
import { SubNav } from "@/content/sub-nav";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 font-mono">
        <Header />
        <SubNav />
        <main className="flex-1 px-4 py-4">{children}</main>
        <Footer />
      </div>
      <Toaster
        toastOptions={{
          classNames: {
            toast:
              "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg rounded-none!",
            description: "group-[.toast]:text-muted-foreground",
            actionButton:
              "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground rounded-none!",
            cancelButton:
              "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
            closeButton: "group-[.toast]:text-muted-foreground",
          },
        }}
        icons={{
          success: null,
          error: null,
          warning: null,
          info: null,
          loading: null,
        }}
      />
    </ThemeProvider>
  );
}
