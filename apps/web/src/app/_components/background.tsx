"use client";
import React from "react";

export default function Background({
  children,
}: {
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    function mouseMoveEvent(e: MouseEvent) {
      const scale = window.visualViewport.scale;
      // disable mouse movement on viewport zoom - causes page to slow down
      if (scale === 1) {
        const body = document.body;

        const targetX = e.clientX;
        const targetY = e.clientY;

        body.style.setProperty("--x", `${targetX}px`);
        body.style.setProperty("--y", `${targetY}px`);
      }
    }

    document.addEventListener("mousemove", mouseMoveEvent);
    return () => {
      document.removeEventListener("mousemove", mouseMoveEvent);
    };
  }, []);

  return (
    <>
      <div className="absolute inset-0 z-[-1]">
        <div className="absolute inset-0 z-[-1] bg-muted-foreground/20" />
        <div
          className="absolute z-[-1] h-56 w-56 rounded-full -translate-y-1/2 -translate-x-1/2 bg-gradient-radial from-muted-foreground/70 from-0% to-transparent to-90% blur-md"
          style={{ left: "var(--x)", top: "var(--y)" }}
        />
        <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
          <defs>
            <pattern
              id="dotted-pattern"
              width="16"
              height="16"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2" cy="2" r="1" fill="black" />
            </pattern>
            <mask id="dots-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect width="100%" height="100%" fill="url(#dotted-pattern)" />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="hsl(var(--background))"
            mask="url(#dots-mask)"
          />
        </svg>
      </div>
      {children}
    </>
  );
}
