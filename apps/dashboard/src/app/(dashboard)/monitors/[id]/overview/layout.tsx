import { SidebarProvider } from "@/components/ui/sidebar";
import { Sidebar } from "../sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={false}>
      {/* blur-2xl */}
      <div className="w-full flex-1">{children}</div>
      <div className="hidden lg:block">
        <Sidebar />
      </div>
    </SidebarProvider>
  );
}
