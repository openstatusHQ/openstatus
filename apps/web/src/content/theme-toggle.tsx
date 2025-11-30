"use client";

import { cn } from "@/lib/utils";
import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import type * as React from "react";
import { useEffect, useState } from "react";

export function ThemeToggle({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn(
          "flex items-center gap-px bg-border [&>*]:flex [&>*]:flex-1 [&>*]:items-center [&>*]:justify-center [&>*]:bg-background [&>*]:p-4",
          className,
        )}
        {...props}
      >
        <div>
          <Sun className="h-6 w-6" />
        </div>
        <div>
          <Moon className="h-6 w-6" />
        </div>
        <div>
          <Laptop className="h-6 w-6" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-px bg-border [&>*]:flex [&>*]:flex-1 [&>*]:items-center [&>*]:justify-center [&>*]:bg-background [&>*]:p-4 [&>*]:hover:bg-muted [&>*]:data-[active=true]:bg-muted",
        className,
      )}
      {...props}
    >
      <button
        type="button"
        data-active={theme === "light"}
        onClick={() => setTheme("light")}
      >
        [light]
      </button>
      <button
        type="button"
        data-active={theme === "dark"}
        onClick={() => setTheme("dark")}
      >
        [dark]
      </button>
      <button
        type="button"
        data-active={theme === "system"}
        onClick={() => setTheme("system")}
      >
        [system]
      </button>
    </div>
  );
}
