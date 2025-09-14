import {
  FloatingButton,
  StatusPageProvider,
} from "@/components/status-page/floating-button";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";
import { z } from "zod";

export const schema = z.object({
  card: z.enum(["duration", "requests", "manual"]).default("duration"),
  bar: z.enum(["absolute", "manual"]).default("absolute"),
  uptime: z.boolean().default(true),
  theme: z.enum(["default"]).default("default"),
});

const DISPLAY_FLOATING_BUTTON =
  process.env.NODE_ENV === "development" ||
  process.env.ENABLE_FLOATING_BUTTON === "true";

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

  const validation = schema.safeParse(page?.configuration);

  return (
    <HydrateClient>
      <ThemeProvider
        attribute="class"
        defaultTheme={page?.forceTheme ?? "system"}
        enableSystem
        disableTransitionOnChange
      >
        <StatusPageProvider
          defaultBarType={validation.data?.bar}
          defaultCardType={validation.data?.card}
          defaultShowUptime={validation.data?.uptime}
          defaultCommunityTheme={validation.data?.theme}
        >
          {children}
          {DISPLAY_FLOATING_BUTTON ? <FloatingButton /> : null}
          <Toaster richColors expand />
        </StatusPageProvider>
      </ThemeProvider>
    </HydrateClient>
  );
}
