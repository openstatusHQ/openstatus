"use client";

import { useEffect, useRef } from "react";
import createGlobe from "cobe";

import { Badge } from "@openstatus/ui";

import type { Feature, SpecialFeature } from "@/config/features";
import { Shell } from "../dashboard/shell";
import { Icons } from "../icons";

export function MonitoringCard(props: Feature) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let phi = 0;
    if (!canvasRef.current) return;

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: 600 * 2,
      height: 600 * 2,
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
        // longitude latitude
        // { location: [37.7595, -122.4367], size: 0.05 },
        // { location: [40.7128, -74.006], size: 0.05 },
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
        state.phi = phi;
        phi += 0.003;
      },
    });

    return () => {
      globe.destroy();
    };
  }, []);

  const Icon = Icons[props.icon];
  return (
    <Shell className="mt-8 grid gap-6 bg-gradient-to-br from-[hsl(var(--muted))] from-0% to-transparent to-20%">
      <div className="flex flex-col items-center justify-center gap-3">
        <div className="border-border rounded-full border p-2">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="font-cal bg-gradient-to-tl from-[hsl(var(--muted))] from-0% to-[hsl(var(--foreground))] to-50% bg-clip-text text-center text-4xl text-transparent">
          {props.title}
        </h3>
      </div>
      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          style={{ width: 600, height: 600, maxWidth: "100%", aspectRatio: 1 }}
        />
      </div>
      <ul className="grid gap-4 md:grid-cols-3 md:gap-6">
        {props.features?.map((feature, i) => {
          const FeatureIcon = Icons[feature.icon];
          return (
            <li key={i}>
              <p className="flex flex-col">
                <span>
                  <FeatureIcon className="text-foreground/80 mb-1 mr-1.5 inline-flex h-4 w-4" />
                  <span className="text-foreground font-medium">
                    {feature.catchline.replace(".", "")}
                  </span>{" "}
                </span>
                <span className="text-muted-foreground">
                  {feature.description}
                </span>
              </p>
              {feature.badge ? (
                <Badge variant="secondary" className="-ml-2 mt-1">
                  {feature.badge}
                </Badge>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}

export function SpecialCardMonitoring(props: SpecialFeature) {
  const Icon = Icons[props.icon];
  return (
    <Shell className="relative flex items-center justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h3 className="font-cal text-3xl">{props.title}</h3>
          <div className="border-border rounded-full border p-2">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="text-muted-foreground mt-2">{props.description}</p>
      </div>
      <div />
    </Shell>
  );
}
