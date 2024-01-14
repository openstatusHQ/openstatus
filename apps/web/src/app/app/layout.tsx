import { ClerkProvider } from "@clerk/nextjs";

import { PHProvider } from "@/providers/posthog";

export default function AuthLayout({
  children, // will be a page or nested layout
}: {
  children: React.ReactNode;
}) {
  return (
    // <Suspense>
    //     <PostHogPageview />
    //   </Suspense>
    <PHProvider>
      <ClerkProvider>{children}</ClerkProvider>
    </PHProvider>
  );
}
