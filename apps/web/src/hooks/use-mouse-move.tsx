"use client";

import React from "react";

export default function useMouseMove() {
  React.useEffect(() => {
    function mouseMoveEvent(e: MouseEvent) {
      const scale = window.visualViewport?.scale;
      // disable mouse movement on viewport zoom - causes page to slow down
      if (scale === 1) {
        const body = document.body;

        const targetX = e.clientX;
        const targetY = e.clientY;

        // TODO: make it move around cursor so you feal like its floating around it
        // the animation requires tranformX and transformY on the HTML Element
        body.style.setProperty("--x", `${targetX}px`);
        body.style.setProperty("--y", `${targetY}px`);
      }
    }

    document.addEventListener("mousemove", mouseMoveEvent);
    return () => {
      document.removeEventListener("mousemove", mouseMoveEvent);
    };
  }, []);
}
