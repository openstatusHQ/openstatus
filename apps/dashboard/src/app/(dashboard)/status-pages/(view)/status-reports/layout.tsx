import { SidebarProvider } from "@/components/ui/sidebar";
import { Sidebar } from "../sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="w-full flex-1">{children}</div>
      <div className="hidden lg:block">
        <Sidebar />
      </div>
    </SidebarProvider>
  );
}
