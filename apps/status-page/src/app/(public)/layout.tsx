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
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
      <Toaster richColors expand />
    </ThemeProvider>
  );
}
