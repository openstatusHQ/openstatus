import type React from "react";

/**
 * Wraps `Eyebrow` + `h2` + `Grid` steps in a vertical rail; each `Eyebrow`
 * becomes a marker on it. `globals.css` drops the rules between steps.
 */
export function Timeline({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-slot="timeline"
      className="before:bg-border relative my-12 pl-6 before:absolute before:top-2 before:bottom-0 before:left-[5px] before:w-px md:pl-10"
    >
      {children}
    </div>
  );
}
