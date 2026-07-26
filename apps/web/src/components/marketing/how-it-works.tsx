import { Badge } from "@openstatus/ui/components/ui/badge";
import { Card, CardContent } from "@openstatus/ui/components/ui/card";
import { Bell, ChevronRight, Globe, Monitor } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Step = {
  step: number;
  icon: LucideIcon;
  title: string;
  description: string;
};

const steps: Step[] = [
  {
    step: 1,
    icon: Monitor,
    title: "Add your monitors",
    description:
      "Connect your websites and APIs in seconds. Set your check frequency and regions.",
  },
  {
    step: 2,
    icon: Bell,
    title: "Get notified instantly",
    description:
      "Receive alerts via email, Slack, or SMS the moment downtime is detected.",
  },
  {
    step: 3,
    icon: Globe,
    title: "Share your status",
    description:
      "Publish a beautiful public status page to keep your users informed.",
  },
];

export function HowItWorks() {
  return (
    <section className="not-prose bg-muted/60 -mx-4 my-12 rounded-lg px-4 py-16 sm:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          How it works
        </h2>
        <p className="text-muted-foreground mt-3 text-sm sm:text-base">
          From first check to public status page — set up in minutes, not
          days.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
        {steps.map(({ step, icon: Icon, title, description }, index) => (
          <Card key={step} className="relative shadow-none">
            <Badge
              variant="outline"
              className="border-success/30 bg-success/15 text-success absolute -top-3 -left-3 flex h-7 w-7 items-center justify-center rounded-full p-0"
            >
              {step}
            </Badge>
            {index < steps.length - 1 ? (
              <ChevronRight
                aria-hidden
                strokeWidth={1.5}
                className="text-muted-foreground/20 absolute top-1/2 -right-6 hidden h-4 w-4 -translate-y-1/2 md:block"
              />
            ) : null}
            <CardContent className="flex flex-col items-center gap-3 text-center">
              <div className="bg-success/10 text-success flex h-12 w-12 items-center justify-center rounded-full">
                <Icon className="h-6 w-6" aria-hidden />
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-muted-foreground text-sm">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
