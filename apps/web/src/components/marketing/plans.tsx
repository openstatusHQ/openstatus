import Link from "next/link";
import { Check } from "lucide-react";

import type { PlanProps } from "@/config/plans";
import { plansConfig } from "@/config/plans";
import { cn } from "@/lib/utils";
import { Shell } from "../dashboard/shell";
import { LoadingAnimation } from "../loading-animation";
import { Button } from "../ui/button";

export function Plans() {
  return (
    <Shell>
      <div className="grid gap-4 md:grid-cols-2 md:gap-0">
        <Plan
          {...plansConfig.free}
          className="md:border-border/50 md:border-r md:pr-4"
        />
        <Plan {...plansConfig.pro} className="md:pl-4" />
        <Plan
          {...plansConfig.enterprise}
          className="md:border-border/50 col-span-full md:mt-4 md:border-t md:pt-4"
        />
      </div>
    </Shell>
  );
}

interface Props extends PlanProps {
  className?: string;
}

export function Plan({
  title,
  description,
  cost,
  features,
  action,
  disabled,
  className,
  loading,
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
            {typeof cost === "number" ? (
              <>
                <span className="font-cal text-2xl">{cost} €</span>
                <span className="text-muted-foreground font-light">/month</span>
              </>
            ) : (
              <span className="font-cal text-2xl">{cost}</span>
            )}
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
      {action ? (
        <div>
          {"link" in action ? (
            <Button asChild size="sm">
              <Link href={action.link}>{action.text}</Link>
            </Button>
          ) : null}
          {"onClick" in action ? (
            <Button
              onClick={action.onClick}
              size="sm"
              disabled={disabled || loading}
            >
              {loading ? <LoadingAnimation /> : action.text}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
