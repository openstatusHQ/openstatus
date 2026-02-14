"use client";

import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import Image from "next/image";
import type { ImageProps } from "next/image";
import { useEffect, useState } from "react";
import Zoom, {
  type ControlledProps,
  type UncontrolledProps,
} from "react-medium-image-zoom";

export type ImageZoomProps = UncontrolledProps & {
  isZoomed?: ControlledProps["isZoomed"];
  onZoomChange?: ControlledProps["onZoomChange"];
  className?: string;
  backdropClassName?: string;
  "aria-hidden"?: boolean;
  inert?: true;
};

export const ImageZoom = ({
  className,
  backdropClassName,
  "aria-hidden": ariaHidden,
  inert,
  ...props
}: ImageZoomProps) => (
  <div
    aria-hidden={ariaHidden}
    inert={inert}
    className={cn(
      "relative",
      "[&_[data-rmiz-ghost]]:pointer-events-none [&_[data-rmiz-ghost]]:absolute",
      "[&_[data-rmiz-btn-zoom]]:m-0 [&_[data-rmiz-btn-zoom]]:size-10 [&_[data-rmiz-btn-zoom]]:touch-manipulation [&_[data-rmiz-btn-zoom]]:appearance-none [&_[data-rmiz-btn-zoom]]:rounded-[50%] [&_[data-rmiz-btn-zoom]]:border-none [&_[data-rmiz-btn-zoom]]:bg-foreground/70 [&_[data-rmiz-btn-zoom]]:p-2 [&_[data-rmiz-btn-zoom]]:text-background [&_[data-rmiz-btn-zoom]]:outline-offset-2",
      "[&_[data-rmiz-btn-unzoom]]:m-0 [&_[data-rmiz-btn-unzoom]]:size-10 [&_[data-rmiz-btn-unzoom]]:touch-manipulation [&_[data-rmiz-btn-unzoom]]:appearance-none [&_[data-rmiz-btn-unzoom]]:rounded-[50%] [&_[data-rmiz-btn-unzoom]]:border-none [&_[data-rmiz-btn-unzoom]]:bg-foreground/70 [&_[data-rmiz-btn-unzoom]]:p-2 [&_[data-rmiz-btn-unzoom]]:text-background [&_[data-rmiz-btn-unzoom]]:outline-offset-2",
      "[&_[data-rmiz-btn-zoom]:not(:focus):not(:active)]:pointer-events-none [&_[data-rmiz-btn-zoom]:not(:focus):not(:active)]:absolute [&_[data-rmiz-btn-zoom]:not(:focus):not(:active)]:size-px [&_[data-rmiz-btn-zoom]:not(:focus):not(:active)]:overflow-hidden [&_[data-rmiz-btn-zoom]:not(:focus):not(:active)]:whitespace-nowrap [&_[data-rmiz-btn-zoom]:not(:focus):not(:active)]:[clip-path:inset(50%)] [&_[data-rmiz-btn-zoom]:not(:focus):not(:active)]:[clip:rect(0_0_0_0)]",
      "[&_[data-rmiz-btn-zoom]]:absolute [&_[data-rmiz-btn-zoom]]:top-2.5 [&_[data-rmiz-btn-zoom]]:right-2.5 [&_[data-rmiz-btn-zoom]]:bottom-auto [&_[data-rmiz-btn-zoom]]:left-auto [&_[data-rmiz-btn-zoom]]:cursor-zoom-in",
      "[&_[data-rmiz-btn-unzoom]]:absolute [&_[data-rmiz-btn-unzoom]]:top-5 [&_[data-rmiz-btn-unzoom]]:right-5 [&_[data-rmiz-btn-unzoom]]:bottom-auto [&_[data-rmiz-btn-unzoom]]:left-auto [&_[data-rmiz-btn-unzoom]]:z-[1] [&_[data-rmiz-btn-unzoom]]:cursor-zoom-out",
      '[&_[data-rmiz-content="found"]_img]:cursor-zoom-in',
      '[&_[data-rmiz-content="found"]_svg]:cursor-zoom-in',
      '[&_[data-rmiz-content="found"]_[role="img"]]:cursor-zoom-in',
      '[&_[data-rmiz-content="found"]_[data-zoom]]:cursor-zoom-in',
      className,
    )}
  >
    <Zoom
      classDialog={cn(
        "[&::backdrop]:hidden",
        "[&[open]]:fixed [&[open]]:m-0 [&[open]]:h-dvh [&[open]]:max-h-none [&[open]]:w-dvw [&[open]]:max-w-none [&[open]]:overflow-hidden [&[open]]:border-0 [&[open]]:bg-transparent [&[open]]:p-0",
        "[&_[data-rmiz-modal-overlay]]:absolute [&_[data-rmiz-modal-overlay]]:inset-0 [&_[data-rmiz-modal-overlay]]:transition-all",
        '[&_[data-rmiz-modal-overlay="hidden"]]:bg-transparent',
        '[&_[data-rmiz-modal-overlay="visible"]]:bg-background/80 [&_[data-rmiz-modal-overlay="visible"]]:backdrop-blur-md',
        "[&_[data-rmiz-modal-content]]:relative [&_[data-rmiz-modal-content]]:size-full",
        "[&_[data-rmiz-modal-img]]:absolute [&_[data-rmiz-modal-img]]:origin-top-left [&_[data-rmiz-modal-img]]:cursor-zoom-out [&_[data-rmiz-modal-img]]:transition-transform",
        "motion-reduce:[&_[data-rmiz-modal-img]]:transition-none motion-reduce:[&_[data-rmiz-modal-overlay]]:transition-none",
        backdropClassName,
      )}
      {...props}
    />
  </div>
);

interface ZoomableImageProps extends ImageProps {
  darkSrc?: string;
  imageWidth: number;
  imageHeight: number;
}

export function ZoomableImage({
  src,
  alt,
  className,
  darkSrc,
  imageWidth,
  imageHeight,
  ...rest
}: ZoomableImageProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <figure>
      <ImageZoom
        backdropClassName={cn(
          '[&_[data-rmiz-modal-overlay="visible"]]:bg-black/80',
        )}
        zoomMargin={16}
        aria-hidden={mounted ? isDark : undefined}
        inert={mounted && isDark ? true : undefined}
        className="block dark:hidden"
      >
        <Image
          {...rest}
          src={src}
          alt={alt ?? ""}
          width={imageWidth}
          height={imageHeight}
          sizes="100vw"
          style={{ width: "100%", height: "auto" }}
          className={className}
        />
      </ImageZoom>
      <ImageZoom
        backdropClassName={cn(
          '[&_[data-rmiz-modal-overlay="visible"]]:bg-black/80',
        )}
        zoomMargin={16}
        aria-hidden={mounted ? !isDark : undefined}
        inert={mounted && !isDark ? true : undefined}
        className="hidden dark:block"
      >
        <Image
          {...rest}
          src={darkSrc ?? src}
          alt={alt ?? ""}
          width={imageWidth}
          height={imageHeight}
          sizes="100vw"
          style={{ width: "100%", height: "auto" }}
          className={className}
        />
      </ImageZoom>
      {alt && <figcaption>{alt}</figcaption>}
    </figure>
  );
}
