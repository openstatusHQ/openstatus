import { TailwindIndicator } from "@/components/tailwind-indicator";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import Background from "../_components/background";

export default function PagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <Background>{children}</Background>
      <Toaster richColors closeButton />
      <TailwindIndicator />
    </ThemeProvider>
  );
}
