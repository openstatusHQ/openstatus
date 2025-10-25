import { Link } from "@/components/common/link";
import { ThemeProvider } from "@/components/themes/theme-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { generateThemeStyles } from "@openstatus/theme-store";
import PlausibleProvider from "next-plausible";
import { SidebarTrigger, ThemeSidebar } from "./theme-sidebar";

const SIDEBAR_WIDTH = "20rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";

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
        {/* defaultOpen={false} */}
        <SidebarProvider
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH,
              "--sidebar-width-mobile": SIDEBAR_WIDTH_MOBILE,
            } as React.CSSProperties
          }
        >
          <SidebarInset className="relative">
            <SidebarTrigger className="absolute top-4 right-4" />
            <main className="mx-auto">{children}</main>
            <footer className="flex items-center justify-center gap-4 p-4 text-center font-mono text-muted-foreground text-sm">
              <p>
                powered by <Link href="https://openstatus.dev">openstatus</Link>
              </p>
            </footer>
          </SidebarInset>
          <ThemeSidebar />
        </SidebarProvider>
        <Toaster richColors expand />
      </ThemeProvider>
    </PlausibleProvider>
  );
}
