import { cn } from "@/lib/utils";

type Props = React.HTMLAttributes<HTMLDivElement>;

export function LoadingAnimation({ className, ...props }: Props) {
  return (
    <div
      className={cn("flex items-center justify-center gap-1", className)}
      {...props}
    >
      <div className="direction-alternate bg-primary-foreground h-1 w-1 animate-pulse rounded-full duration-700" />
      <div className="direction-alternate bg-primary-foreground h-1 w-1 animate-pulse rounded-full delay-150 duration-700" />
      <div className="direction-alternate bg-primary-foreground h-1 w-1 animate-pulse rounded-full delay-300 duration-700" />
    </div>
  );
}
