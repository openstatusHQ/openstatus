import { readFileSync } from "node:fs";
import { join } from "node:path";

interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Get image dimensions from PNG file
 * PNG spec: width and height are stored at bytes 16-23 as 4-byte integers
 */
function getPngDimensions(buffer: Buffer): ImageDimensions {
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

/**
 * Get image dimensions from JPEG file
 */
function getJpegDimensions(buffer: Buffer): ImageDimensions {
  let offset = 2; // Skip SOI marker

  while (offset < buffer.length) {
    // Check for marker
    if (buffer[offset] !== 0xff) break;

    const marker = buffer[offset + 1];
    offset += 2;

    // SOF markers (Start of Frame)
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      return { width, height };
    }

    // Skip to next marker
    const segmentLength = buffer.readUInt16BE(offset);
    offset += segmentLength;
  }

  throw new Error("Could not find JPEG dimensions");
}

function getSvgDimensions(content: string): ImageDimensions | null {
  const svgTag = content.match(/<svg\b[^>]*>/i)?.[0];
  if (!svgTag) return null;

  const widthAttr = svgTag.match(
    /\bwidth\s*=\s*["']?(\d+(?:\.\d+)?)(?:px)?["'\s/>]/i,
  )?.[1];
  const heightAttr = svgTag.match(
    /\bheight\s*=\s*["']?(\d+(?:\.\d+)?)(?:px)?["'\s/>]/i,
  )?.[1];
  if (widthAttr && heightAttr) {
    return { width: Number(widthAttr), height: Number(heightAttr) };
  }

  const viewBox = svgTag.match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1];
  if (viewBox) {
    const parts = viewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      return { width: parts[2], height: parts[3] };
    }
  }

  return null;
}

/**
 * Get dimensions for an image in the public directory
 */
export function getImageDimensions(publicPath: string): ImageDimensions | null {
  try {
    const fullPath = join(process.cwd(), "public", publicPath);
    const buffer = readFileSync(fullPath);

    // Check file signature
    if (buffer[0] === 0x89 && buffer.toString("ascii", 1, 4) === "PNG") {
      return getPngDimensions(buffer);
    }

    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      return getJpegDimensions(buffer);
    }

    if (publicPath.toLowerCase().endsWith(".svg")) {
      return getSvgDimensions(buffer.toString("utf8"));
    }

    return null;
  } catch (error) {
    console.warn(`Failed to get dimensions for ${publicPath}:`, error);
    return null;
  }
}
