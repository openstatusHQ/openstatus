import { existsSync } from "node:fs";
import { join } from "node:path";
import { getImageDimensions } from "@/lib/image-dimensions";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { ImageZoom, ZoomableImage } from "../image-zoom";

export function CustomImage({
  className,
  ...props
}: React.ComponentProps<typeof Image>) {
  const { src, alt, width, height, ...rest } = props;

  if (!src || typeof src !== "string") {
    return (
      <figure>
        <ImageZoom
          backdropClassName={cn(
            '[&_[data-rmiz-modal-overlay="visible"]]:bg-background/80',
          )}
          zoomMargin={16}
        >
          <Image
            className={className}
            src={src}
            alt={alt ?? "image"}
            fill
            sizes="100vw"
            style={{ objectFit: "contain" }}
            {...rest}
          />
        </ImageZoom>
        <figcaption>{alt}</figcaption>
      </figure>
    );
  }

  // Get actual image dimensions from filesystem
  const dimensions = getImageDimensions(src);
  const imageWidth = width || dimensions?.width || 1200;
  const imageHeight = height || dimensions?.height || 630;

  // Generate dark mode image path by adding .dark before extension
  const getDarkImagePath = (path: string) => {
    const match = path.match(/^(.+)(\.[^.]+)$/);
    if (match) {
      return `${match[1]}.dark${match[2]}`;
    }
    return path;
  };

  // Check if dark image exists, fallback to light version if not
  const checkDarkImageExists = (darkPath: string) => {
    // If path starts with /, it's in the public directory
    if (darkPath.startsWith("/")) {
      const publicPath = join(process.cwd(), "public", darkPath);
      return existsSync(publicPath);
    }
    // For relative paths, check relative to public
    const publicPath = join(process.cwd(), "public", darkPath);
    return existsSync(publicPath);
  };

  const darkSrc = getDarkImagePath(src);
  const useDarkImage = checkDarkImageExists(darkSrc);

  return (
    <ZoomableImage
      {...rest}
      src={src}
      alt={alt}
      className={className}
      darkSrc={useDarkImage ? darkSrc : undefined}
      imageWidth={imageWidth as number}
      imageHeight={imageHeight as number}
    />
  );
}
