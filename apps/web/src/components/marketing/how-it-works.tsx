"use client";

import { cn } from "@/lib/utils";
import { Bell, Globe, Monitor } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const steps = [
  {
    number: 1,
    title: "Add your monitors",
    description:
      "Add websites and APIs. Choose interval and regions. Add assertions (status, headers, body).",
    icon: Monitor,
  },
  {
    number: 2,
    title: "Get notified instantly",
    description:
      "Alert on failures and latency. Notify via email + integrations like Slack, Discord, and PagerDuty.",
    icon: Bell,
  },
  {
    number: 3,
    title: "Share your status",
    description:
      "Publish a clean status page that reflects incidents automatically. Customize theme and branding.",
    icon: Globe,
  },
] as const;

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.unobserve(el);
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isInView };
}

function StepCard({
  step,
  index,
  isVisible,
}: {
  step: (typeof steps)[number];
  index: number;
  isVisible: boolean;
}) {
  const Icon = step.icon;
  return (
    <div
      className={cn(
        "relative flex flex-col gap-4 border border-border bg-background p-6",
        "transition-all duration-500 ease-out",
        "hover:border-success/50 hover:shadow-[0_0_20px_-4px] hover:shadow-success/15",
        isVisible
          ? "translate-y-0 opacity-100"
          : "translate-y-8 opacity-0",
      )}
      style={{ transitionDelay: `${index * 150}ms` }}
    >
      <span
        className="flex h-6 w-6 items-center justify-center border border-success/40 bg-success/10 font-mono text-xs text-success"
        aria-hidden="true"
      >
        {step.number}
      </span>
      <div className="flex items-center gap-3">
        <Icon
          className="h-5 w-5 shrink-0 text-success"
          aria-hidden="true"
        />
        <h3 className="font-mono text-sm font-medium text-foreground">
          {step.title}
        </h3>
      </div>
      <p className="font-mono text-sm leading-relaxed text-muted-foreground">
        {step.description}
      </p>
    </div>
  );
}

function DottedConnector({ isVisible, index }: { isVisible: boolean; index: number }) {
  return (
    <div
      className="hidden items-center justify-center md:flex"
      aria-hidden="true"
    >
      <div
        className={cn(
          "h-px w-full border-t border-dashed border-success/40",
          "transition-all duration-500 ease-out",
          isVisible ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0",
        )}
        style={{ transitionDelay: `${index * 150 + 75}ms` }}
      />
    </div>
  );
}

export function HowItWorks() {
  const { ref, isInView } = useInView(0.15);

  return (
    <section
      ref={ref}
      className="not-prose my-8 border border-border bg-muted/30 p-6 md:p-8"
    >
      <div
        className={cn(
          "mb-8 text-center transition-all duration-500 ease-out",
          isInView ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        )}
      >
        <p className="font-mono text-xs uppercase tracking-widest text-success">
          How it works
        </p>
        <h2 className="mt-2 font-mono text-lg font-medium text-foreground">
          Up and running in minutes
        </h2>
        <p className="mx-auto mt-2 max-w-xl font-mono text-sm text-muted-foreground">
          From endpoint checks to alerts and a public status page — three steps
          is all it takes.
        </p>
      </div>
      <div
        className={cn(
          "grid grid-cols-1 gap-4",
          "md:grid-cols-[1fr_auto_1fr_auto_1fr] md:gap-0",
        )}
      >
        <StepCard step={steps[0]} index={0} isVisible={isInView} />
        <DottedConnector isVisible={isInView} index={0} />
        <StepCard step={steps[1]} index={1} isVisible={isInView} />
        <DottedConnector isVisible={isInView} index={1} />
        <StepCard step={steps[2]} index={2} isVisible={isInView} />
      </div>
    </section>
  );
}
