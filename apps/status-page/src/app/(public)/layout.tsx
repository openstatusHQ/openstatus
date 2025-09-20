import { Link } from "@/components/common/link";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <main>{children}</main>
      <footer className="flex items-center justify-center gap-4 p-4 text-center font-mono text-muted-foreground text-sm">
        <p>
          powered by <Link href="https://openstatus.dev">openstatus</Link>
        </p>
      </footer>
      <Toaster richColors expand />
    </ThemeProvider>
  );
}
