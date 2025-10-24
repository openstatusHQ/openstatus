import { Link } from "@/components/common/link";
import { ThemeProvider } from "@/components/themes/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { generateThemeStyles } from "@openstatus/theme-store";
import PlausibleProvider from "next-plausible";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlausibleProvider domain="themes.openstatus.dev">
      <style
        id="theme-styles"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
        dangerouslySetInnerHTML={{ __html: generateThemeStyles() }}
      />
      <ThemeProvider attribute="class" enableSystem disableTransitionOnChange>
        <main>{children}</main>
        <footer className="flex items-center justify-center gap-4 p-4 text-center font-mono text-muted-foreground text-sm">
          <p>
            powered by <Link href="https://openstatus.dev">openstatus</Link>
          </p>
        </footer>
        <Toaster richColors expand />
      </ThemeProvider>
    </PlausibleProvider>
  );
}
