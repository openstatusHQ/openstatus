import { SidebarProvider } from "@openstatus/ui/components/ui/sidebar";
import { Sidebar } from "../sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={false} className="min-h-0 flex-1">
      {/* blur-2xl */}
      <div className="w-full flex-1">{children}</div>
      <div className="hidden lg:block">
        <Sidebar />
      </div>
    </SidebarProvider>
  );
}
