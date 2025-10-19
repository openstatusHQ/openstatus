import { Link } from "@/components/common/link";
import { ThemeProvider } from "@/components/themes/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import type { Metadata } from "next";
import PlausibleProvider from "next-plausible";

export const metadata: Metadata = {
  title: "Theme Explorer",
};

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlausibleProvider domain="themes.openstatus.dev">
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        // FIXME: forcing the theme to light for our "default" theme which, if dark would display two dark themes - there is no light: tailwind theme
        forcedTheme="light"
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
    </PlausibleProvider>
  );
}
