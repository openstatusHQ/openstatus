import { cn } from "@/lib/utils";
import Image from "next/image";

export function Wordmark({
  size = 24,
  showText = false,
  className,
  href = "https://openstatus.dev",
  target = "_blank",
  rel = "noreferrer",
  ...props
}: Omit<React.ComponentProps<"a">, "children"> & {
  size?: 24 | 32;
  showText?: boolean;
}) {
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      className={cn("flex items-center gap-2", className)}
      {...props}
    >
      <span className="relative block" style={{ height: size, width: size }}>
        <Image
          src="https://openstatus.dev/icon.png"
          alt="openstatus"
          height={size}
          width={size}
          className="rounded-full border border-border"
        />
      </span>
      {showText ? (
        <span
          className={cn(
            "font-cal text-foreground",
            size === 32 ? "text-base" : "text-sm",
          )}
        >
          openstatus
        </span>
      ) : null}
    </a>
  );
}
