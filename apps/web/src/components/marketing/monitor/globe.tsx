"use client";

import createGlobe from "cobe";
import { useEffect, useRef, useState } from "react";

import { useMediaQuery } from "@/hooks/use-media-query";

const SIZE = 350;

// https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/By_example/Detect_WebGL
function isWebGLContext() {
  const canvas = document.createElement("canvas");
  const gl =
    canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

  return gl instanceof WebGLRenderingContext;
}

export function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)",
  );
  const [disabledWebGL, setDisabledWebGL] = useState(false);

  useEffect(() => {
    let phi = 0;
    if (!canvasRef.current) return;
    if (!document) return;
    if (!isWebGLContext()) {
      setDisabledWebGL(true);
      return;
    }

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
        // ARN
        { location: [59.6519, 17.9186], size: 0.05 },
        // ATL
        { location: [33.6407, -84.4277], size: 0.05 },
        // BOG
        { location: [4.711, -74.0721], size: 0.05 },
        // BOM
        { location: [19.0896, 72.8656], size: 0.05 },
        // CDG
        { location: [49.0097, 2.5479], size: 0.05 },
        // DEN
        { location: [39.8561, -104.6737], size: 0.05 },
        // DFW
        { location: [32.8998, -97.0403], size: 0.05 },
        // EWR
        { location: [40.6895, -74.1745], size: 0.05 },
        // EZE
        { location: [-34.8226, -58.5336], size: 0.05 },
        // FRA
        { location: [50.0349, 8.5622], size: 0.05 },
        // GDI
        { location: [20.6752, -103.34], size: 0.05 },
        // LAX
        { location: [33.9416, -118.4085], size: 0.05 },
        // MAD
        { location: [40.4168, -3.7038], size: 0.05 },
        // MIA
        { location: [25.7617, -80.1918], size: 0.05 },
        // NRT
        { location: [35.6895, 139.6917], size: 0.05 },
        // ORD
        { location: [41.9742, -87.9073], size: 0.05 },
        // OTP
        { location: [44.4268, 26.1025], size: 0.05 },
        // PHX
        { location: [33.4484, -112.074], size: 0.05 },
        // QRO
        { location: [20.5881, -100.3899], size: 0.05 },
        // SCL
        { location: [-33.4489, -70.6693], size: 0.05 },
        // SEA
        { location: [47.6062, -122.3321], size: 0.05 },
        // SIN
        { location: [1.3521, 103.8198], size: 0.05 },
        // SJC
        { location: [37.3541, -121.9552], size: 0.05 },
        // WAW
        { location: [52.2297, 21.0122], size: 0.05 },
        // YUL
        { location: [45.5017, -73.5673], size: 0.05 },
        // YYZ
        { location: [43.6511, -79.347], size: 0.05 },
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

  if (disabledWebGL) {
    return (
      <div className="flex items-center justify-center">
        <p className="text-muted-foreground text-sm">
          <span className="font-semibold">Hint</span>: enable{" "}
          <span className="font-semibold">WebGL</span> to render the globe.
        </p>
      </div>
    );
  }

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
