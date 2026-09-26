"use client";

import { System, Dark, Light } from "@openstatus/icons";
import { useTheme } from "next-themes";
import type * as React from "react";
import { useEffect, useState } from "react";

import { cn } from "../lib/utils";

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
          <Light className="h-6 w-6" />
        </div>
        <div>
          <Dark className="h-6 w-6" />
        </div>
        <div>
          <System className="h-6 w-6" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-border [&>*]:bg-background [&>*]:hover:bg-muted [&>*]:data-[active=true]:bg-muted flex items-center gap-px [&>*]:flex [&>*]:min-w-0 [&>*]:flex-1 [&>*]:items-center [&>*]:justify-center [&>*]:p-4",
        className,
      )}
      {...props}
    >
      <button
        type="button"
        data-active={theme === "light"}
        onClick={() => setTheme("light")}
      >
        <span className="min-w-0 truncate">[light]</span>
      </button>
      <button
        type="button"
        data-active={theme === "dark"}
        onClick={() => setTheme("dark")}
      >
        <span className="min-w-0 truncate">[dark]</span>
      </button>
      <button
        type="button"
        data-active={theme === "system"}
        onClick={() => setTheme("system")}
      >
        <span className="min-w-0 truncate">[system]</span>
      </button>
    </div>
  );
}
