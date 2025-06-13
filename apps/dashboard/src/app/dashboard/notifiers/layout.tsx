import { AppHeader, AppHeaderContent } from "@/components/nav/app-header";
import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { AppSidebarTrigger } from "@/components/nav/app-sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <AppHeader>
        <AppHeaderContent>
          <AppSidebarTrigger />
          <NavBreadcrumb items={[{ type: "page", label: "Notifiers" }]} />
        </AppHeaderContent>
      </AppHeader>
      <main className="w-full flex-1">{children}</main>
    </div>
  );
}
