"use client";

import type * as React from "react";

import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

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
          "bg-border [&>*]:bg-background flex items-center gap-px [&>*]:flex [&>*]:flex-1 [&>*]:items-center [&>*]:justify-center [&>*]:p-4",
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
        "bg-border [&>*]:bg-background [&>*]:hover:bg-muted [&>*]:data-[active=true]:bg-muted flex items-center gap-px [&>*]:flex [&>*]:flex-1 [&>*]:items-center [&>*]:justify-center [&>*]:p-4",
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
