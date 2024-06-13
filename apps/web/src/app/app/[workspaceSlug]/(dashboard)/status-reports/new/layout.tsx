import { Header } from "@/components/dashboard/header";
import AppPageLayout from "@/components/layout/app-page-layout";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppPageLayout>
      <Header
        title="Status Report"
        description="Create a public report for your incident."
      />
      {children}
    </AppPageLayout>
  );
}
