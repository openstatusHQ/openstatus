import {
  RIGHT_SIDEBAR_COOKIE,
  getSidebarDefaultOpen,
} from "@/lib/sidebar-cookie";
import { SidebarProvider } from "@openstatus/ui/components/ui/sidebar";
import { Sidebar } from "../sidebar";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const defaultOpen = await getSidebarDefaultOpen(RIGHT_SIDEBAR_COOKIE, false);
  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      cookieName={RIGHT_SIDEBAR_COOKIE}
      className="min-h-0 flex-1 [--sidebar-width:18rem] 2xl:[--sidebar-width:24rem]"
    >
      {/* blur-2xl */}
      <div className="w-full flex-1">{children}</div>
      <div className="hidden lg:block">
        <Sidebar />
      </div>
    </SidebarProvider>
  );
}
