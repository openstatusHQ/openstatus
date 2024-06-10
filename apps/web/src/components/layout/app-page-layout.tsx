import { Shell } from "@/components/dashboard/shell";
import { cn } from "@/lib/utils";
import { HelpCallout } from "../dashboard/help-callout";

export default function AppPageLayout({
  children,
  className,
  withHelpCallout = false,
}: {
  children: React.ReactNode;
  className?: string;
  withHelpCallout?: boolean; // TODO: remove as we have the `Bubble` component for support
}) {
  return (
    <Shell className="relative flex flex-1 flex-col overflow-x-hidden">
      <div
        className={cn("flex h-full flex-1 flex-col gap-6 md:gap-8", className)}
      >
        {children}
      </div>
      {withHelpCallout ? (
        <div className="mt-4">
          <HelpCallout />
        </div>
      ) : null}
    </Shell>
  );
}
