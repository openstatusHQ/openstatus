"use client";

import { useEffect, useRef, useState } from "react";
import QRCodeStyling, {
  type Options as QRCodeOptions,
} from "qr-code-styling";
import { cn } from "@openstatus/ui/lib/utils";

export interface QRCodeProps {
  data: string;
  image?: string;
  size?: number;
  className?: string;
  options?: Partial<QRCodeOptions>;
}

export const QRCode = ({
  data,
  image,
  size = 200,
  className,
  options,
}: QRCodeProps) => {
  const [qrCode] = useState<QRCodeStyling>(
    new QRCodeStyling({
      width: size,
      height: size,
      type: "svg",
      data,
      image,
      dotsOptions: {
        color: "#000000",
        type: "rounded",
      },
      backgroundOptions: {
        color: "#ffffff",
      },
      imageOptions: {
        crossOrigin: "anonymous",
        margin: 20,
      },
      ...options,
    }),
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      qrCode.append(ref.current);
    }
  }, [qrCode, ref]);

  useEffect(() => {
    if (!qrCode) return;
    qrCode.update({
      data,
      image,
      width: size,
      height: size,
      ...options,
    });
  }, [qrCode, data, image, size, options]);

  return (
    <div
      ref={ref}
      className={cn("flex items-center justify-center", className)}
    />
  );
};
