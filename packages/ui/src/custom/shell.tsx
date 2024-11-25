import { cn } from "@/lib/utils";

type ShellProps = React.HTMLAttributes<HTMLDivElement>;

function Shell({ children, className }: ShellProps) {
  return (
    <div
      className={cn(
        "w-full rounded-lg border border-border px-3 py-4 backdrop-blur-[2px] md:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export { Shell };
