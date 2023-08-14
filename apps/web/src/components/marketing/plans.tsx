import Link from "next/link";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { Shell } from "../dashboard/shell";
import { Button } from "../ui/button";

interface Plan {
  title: string;
  description: string;
  cost: number | string;
  features: string[];
  action?: {
    text: string;
    link: string;
  };
  disabled?: boolean;
}

const plans: Record<"hobby" | "pro" | "enterprise", Plan> = {
  hobby: {
    title: "Hobby",
    description: "Get started now and upgrade once reaching the limits.",
    cost: 0,
    features: [
      "5 monitors",
      "1 status page",
      "subdomain",
      "10m, 30m, 1h checks",
    ],
    action: {
      text: "Start Now",
      link: "/app?plan=hobby",
    },
  },
  pro: {
    title: "Pro",
    description: "Scale and build monitors for all your services.",
    cost: 29,
    features: [
      "20 monitors",
      "5 status page",
      "custom domain",
      "1m, 5m, 10m, 30m, 1h checks",
      "5 team members",
    ],
    action: {
      text: "Start Now",
      link: "/app?plan=pro",
    },
  },
  enterprise: {
    title: "Enterprise",
    description: "Dedicated support and needs for your company.",
    cost: "Lets talk",
    features: [],
    action: {
      text: "Schedule call",
      link: "https://cal.com/thibault-openstatus/30min",
    },
  },
};

export function Plans() {
  return (
    <Shell>
      <div className="grid gap-4 md:grid-cols-2 md:gap-0">
        <Plan
          {...plans.hobby}
          className="md:border-border/50 md:border-r md:pr-4"
        />
        <Plan {...plans.pro} className="md:pl-4" />
        <Plan
          {...plans.enterprise}
          className="md:border-border/50 col-span-full md:mt-4 md:border-t md:pt-4"
        />
      </div>
    </Shell>
  );
}

interface Props extends Plan {
  className?: string;
}

function Plan({
  title,
  description,
  cost,
  features,
  action,
  disabled,
  className,
}: Props) {
  return (
    <div
      key={title}
      className={cn(
        "flex w-full flex-col",
        disabled && "pointer-events-none opacity-70",
        className,
      )}
    >
      <div className="flex-1">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-cal mb-2 text-xl">{title}</p>
            <p className="text-muted-foreground">{description}</p>
          </div>
          <p className="shrink-0">
            <span className="font-cal text-2xl">{cost}</span>
            {typeof cost === "number" ? (
              <span className="text-muted-foreground font-light">/month</span>
            ) : null}
          </p>
        </div>
        <ul className="border-border/50 grid divide-y py-2">
          {features.map((item) => (
            <li
              key={item}
              className="text-muted-foreground inline-flex items-center py-2 text-sm"
            >
              <Check className="mr-2 h-4 w-4 text-green-500" />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div>
        {action ? (
          <Button asChild size="sm">
            <Link href={action.link}>{action.text}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
