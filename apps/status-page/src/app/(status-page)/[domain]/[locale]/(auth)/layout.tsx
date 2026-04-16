import { EmbedShell } from "@/components/layout/embed-shell";
import { Footer } from "@/components/nav/footer";
import { getQueryClient, trpc } from "@/lib/trpc/server";
import { cn } from "@openstatus/ui/lib/utils";
import { Suspense } from "react";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ domain: string }>;
}) {
  const queryClient = getQueryClient();
  const { domain } = await params;
  await queryClient.prefetchQuery(
    trpc.statusPage.get.queryOptions({ slug: domain }),
  );

  return (
    <Suspense>
      <EmbedShell
        className={cn(
          "flex min-h-screen flex-col gap-4",
          "group-data-[embed=true]/embed:min-h-0",
        )}
      >
        <main
          className={cn(
            "mx-auto flex w-full max-w-2xl flex-1 flex-col px-3 py-2",
            "group-data-[embed=true]/embed:mx-0 group-data-[embed=true]/embed:max-w-none",
          )}
        >
          {children}
        </main>
        <Footer className="w-full border-t" />
      </EmbedShell>
    </Suspense>
  );
}
