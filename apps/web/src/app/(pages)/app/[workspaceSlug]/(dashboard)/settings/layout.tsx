import AppPageWithSidebarLayout from "@/components/layout/app-page-with-sidebar-layout";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppPageWithSidebarLayout id="settings">
      {children}
    </AppPageWithSidebarLayout>
  );
}
