"use client";

import { useEffect, useRef } from "react";
import createGlobe from "cobe";
import { useMediaQuery } from '@/hooks/use-media-query';

const SIZE = 350;

export function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReducedMotion = useMediaQuery('((prefers-reduced-motion: reduce))');

  useEffect(() => {
    let phi = 0;
    if (!canvasRef.current) return;

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: SIZE * 2,
      height: SIZE * 2,
      phi: 0,
      theta: 0,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.3, 0.3, 0.3],
      markerColor: [1, 1, 1],
      glowColor: [1, 1, 1],
      markers: [
        // AMS
        { location: [52.3676, 4.9041], size: 0.05 },
        // IAD
        { location: [39.0438, -77.4874], size: 0.05 },
        // JNB
        { location: [-26.2041, 28.0473], size: 0.05 },
        // HKG
        { location: [22.3193, 114.1694], size: 0.05 },
        // SYD
        { location: [-33.8688, 151.2093], size: 0.05 },
        // GRU
        { location: [-23.5558, -46.6396], size: 0.05 },
      ],
      onRender: (state) => {
        // Called on every animation frame.
        // `state` will be an empty object, return updated params.
        if (!prefersReducedMotion) {
        state.phi = phi;
        phi += 0.003;
      }
      },
    });

    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.style.opacity = "1";
    });

    return () => {
      globe.destroy();
    };
  }, [prefersReducedMotion]);

  return (
    <div className="flex justify-center">
      <canvas
        ref={canvasRef}
        style={{
          width: SIZE,
          height: SIZE,
          maxWidth: "100%",
          aspectRatio: 1,
          opacity: 0,
          transition: "opacity 1s ease",
        }}
      />
    </div>
  );
}
