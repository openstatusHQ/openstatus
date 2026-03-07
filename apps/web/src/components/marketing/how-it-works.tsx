import { Bell, Globe, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  {
    number: 1,
    title: "Add your monitors",
    description:
      "Connect your websites and APIs in seconds. Set your check frequency and regions.",
    icon: Monitor,
  },
  {
    number: 2,
    title: "Get notified instantly",
    description:
      "Receive alerts via email, Slack, or SMS the moment downtime is detected.",
    icon: Bell,
  },
  {
    number: 3,
    title: "Share your status",
    description:
      "Publish a beautiful public status page to keep your users informed.",
    icon: Globe,
  },
];

interface HowItWorksProps {
  className?: string;
}

export function HowItWorks({ className }: HowItWorksProps) {
  return (
    <section
      className={cn(
        "not-prose relative w-full bg-muted/50 py-16 md:py-24",
        className
      )}
    >
      <div className="mx-auto max-w-5xl px-4">
        {/* Header */}
        <div className="mb-12 text-center md:mb-16">
          <h2 className="mb-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            How it works
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Get started in minutes with our simple three-step process
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Desktop connecting line */}
          <div className="absolute left-0 right-0 top-1/2 hidden -translate-y-1/2 md:block">
            <div className="mx-auto flex max-w-3xl items-center justify-between px-24">
              <ConnectingArrow />
              <ConnectingArrow />
            </div>
          </div>

          {/* Cards grid */}
          <div className="relative grid gap-6 md:grid-cols-3 md:gap-8">
            {steps.map((step, index) => (
              <StepCard key={step.number} step={step} index={index} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

interface StepCardProps {
  step: (typeof steps)[number];
  index: number;
}

function StepCard({ step }: StepCardProps) {
  const Icon = step.icon;

  return (
    <div className="group relative flex flex-col items-center rounded-lg border border-border bg-background p-6 text-center shadow-sm transition-shadow hover:shadow-md md:p-8">
      {/* Number badge */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
          {step.number}
        </span>
      </div>

      {/* Icon */}
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-foreground">
        <Icon className="h-6 w-6" />
      </div>

      {/* Content */}
      <h3 className="mb-2 text-lg font-medium text-foreground">{step.title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {step.description}
      </p>
    </div>
  );
}

function ConnectingArrow() {
  return (
    <div className="flex w-full max-w-[120px] items-center">
      {/* Dotted line */}
      <div className="h-px flex-1 border-t-2 border-dashed border-border" />
      {/* Arrow head */}
      <svg
        className="h-3 w-3 -ml-1 text-border"
        fill="none"
        viewBox="0 0 12 12"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M1 6h10M7 2l4 4-4 4" />
      </svg>
    </div>
  );
}
