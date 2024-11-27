import Link from "next/link";

import { cn } from "@/lib/utils";
import { Button } from "@openstatus/ui/src/components/button";

interface InBetweenCTAProps {
  description: string;
  actions: Record<
    "primary" | "secondary",
    { label: string; href: string; target?: string }
  >;
  className?: string;
}

export function InBetweenCTA({
  description,
  actions,
  className,
}: InBetweenCTAProps) {
  const { primary, secondary } = actions;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-6",
        className,
      )}
    >
      <p className="max-w-lg text-center text-lg text-muted-foreground">
        {description}
      </p>
      <div className="flex gap-2">
        <Button className="rounded-full" asChild>
          <Link href={primary.href} target={primary.target}>
            {primary.label}
          </Link>
        </Button>
        <Button className="rounded-full" variant="outline" asChild>
          <Link href={secondary.href} target={secondary.target}>
            {secondary.label}
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function MiddleCTA(props: Pick<InBetweenCTAProps, "className">) {
  return (
    <InBetweenCTA
      description="Sick of booking a demo to know more? Test your endpoint or check our public dashboard right away."
      actions={{
        primary: { label: "Public Dashboard", href: "/public/monitors/1" },
        secondary: { label: "Speed Checker", href: "/play/checker" },
      }}
      {...props}
    />
  );
}

export function BottomCTA(props: Pick<InBetweenCTAProps, "className">) {
  return (
    <InBetweenCTA
      description="Learn how your services are performing over time, and notify your users of any issues."
      actions={{
        primary: { label: "Start for Free", href: "/app/login" },
        secondary: { label: "Schedule a Demo", href: "/cal", target: "_blank" },
      }}
      {...props}
    />
  );
}
