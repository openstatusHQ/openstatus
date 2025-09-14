import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ domain: string }>;
}) {
  const queryClient = getQueryClient();
  const { domain } = await params;
  const page = await queryClient.fetchQuery(
    trpc.statusPage.get.queryOptions({ slug: domain }),
  );

  console.log({ page });
  return (
    <HydrateClient>
      <ThemeProvider
        attribute="class"
        defaultTheme={page?.forceTheme ?? "system"}
        enableSystem
        disableTransitionOnChange
      >
        {children}
        <Toaster richColors expand />
      </ThemeProvider>
    </HydrateClient>
  );
}
