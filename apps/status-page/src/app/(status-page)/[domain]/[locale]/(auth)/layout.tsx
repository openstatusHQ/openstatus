import { IframeShell } from "@/components/layout/iframe-shell";
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
      <IframeShell
        className={cn(
          "flex min-h-screen flex-col gap-4",
          "group-data-[iframe=true]/iframe:min-h-0",
        )}
      >
        <main
          className={cn(
            "mx-auto flex w-full max-w-2xl flex-1 flex-col px-3 py-2",
            "group-data-[iframe=true]/iframe:mx-0 group-data-[iframe=true]/iframe:max-w-none",
          )}
        >
          {children}
        </main>
        <Footer className="w-full border-t" />
      </IframeShell>
    </Suspense>
  );
}
