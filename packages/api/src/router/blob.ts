import { put } from "@vercel/blob";
import { z } from "zod";

import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const SVG_MAX_SIZE_BYTES = 100 * 1024; // 100KB

export function isSvgFile(filename: string): boolean {
  return filename.toLowerCase().endsWith(".svg");
}

export async function sanitizeSvg(svgContent: string): Promise<string> {
  // Lazy import because root.ts merges edge + lambda routers,
  // so this module is evaluated in both runtimes — jsdom can't load on edge
  const { default: DOMPurify } = await import("isomorphic-dompurify");
  return DOMPurify.sanitize(svgContent, {
    USE_PROFILES: { svg: true, svgFilters: true },
    // DOMPurify's SVG profile strips all on* event handlers by default.
    // We explicitly forbid foreignObject (can embed arbitrary HTML),
    // and script (direct code execution).
    // FORBID_CONTENTS ensures text inside forbidden tags is also removed
    // (e.g. alert(...) text from <script> won't leak into the output).
    FORBID_TAGS: ["foreignObject", "script"],
    FORBID_CONTENTS: ["foreignObject", "script"],
  });
}

export const blobRouter = createTRPCRouter({
  upload: protectedProcedure
    .input(
      z.object({
        filename: z.string().min(1),
        // Base64 encoded string (without data: prefix)
        file: z.string().min(1),
      }),
    )
    .mutation(async (opts) => {
      const { filename, file } = opts.input;

      // If the client sent a data URL, strip the prefix
      const base64 = file.includes("base64,")
        ? file.split("base64,").pop()
        : file;

      if (!base64) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid file",
        });
      }

      let buffer = Buffer.from(base64, "base64");

      if (isSvgFile(filename)) {
        if (buffer.byteLength > SVG_MAX_SIZE_BYTES) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "SVG file must be under 100KB",
          });
        }

        const sanitized = await sanitizeSvg(buffer.toString("utf-8"));
        if (!sanitized.trim()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "SVG file contains no valid content after sanitization",
          });
        }
        const sanitizedBuffer = Buffer.from(sanitized, "utf-8");
        if (sanitizedBuffer.byteLength > SVG_MAX_SIZE_BYTES) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "SVG file must be under 100KB",
          });
        }
        buffer = sanitizedBuffer;
      }

      const blob = await put(`${opts.ctx.workspace.slug}/${filename}`, buffer, {
        access: "public",
      });

      return blob;
    }),
});
