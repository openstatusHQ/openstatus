import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@openstatus/ui";

import { Header } from "@/components/dashboard/header";
import AppPageWithSidebarLayout from "@/components/layout/app-page-with-sidebar-layout";
import { api } from "@/trpc/server";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceSlug: string; id: string };
}) {
  const id = params.id;

  const page = await api.page.getPageById.query({
    id: Number(id),
  });

  if (!page) {
    return notFound();
  }

  return (
    <AppPageWithSidebarLayout id="status-pages">
      <Header
        title={page.title}
        description={page.description}
        actions={
          <Button variant="outline" asChild>
            <Link target="_blank" href={`https://${page.slug}.openstatus.dev`}>
              Visit
            </Link>
          </Button>
        }
      />
      {children}
    </AppPageWithSidebarLayout>
  );
}
