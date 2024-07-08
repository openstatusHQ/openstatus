import { cn } from "@/lib/utils";
import type * as React from "react";

interface HeroProps extends React.ComponentPropsWithoutRef<"div"> {
  title: string;
  subTitle: string;
}

export function Hero({ title, subTitle, className, ...props }: HeroProps) {
  return (
    <div
      className={cn(
        "mx-auto my-16 flex max-w-xl flex-col items-center gap-4",
        className
      )}
      {...props}
    >
      <h1 className="font-cal text-5xl">{title}</h1>
      <h2 className="text-center text-2xl text-muted-foreground">{subTitle}</h2>
    </div>
  );
}
