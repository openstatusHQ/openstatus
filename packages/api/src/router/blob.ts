import { put } from "@vercel/blob";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const blobRouter = createTRPCRouter({
  upload: protectedProcedure
    .input(
      z.object({
        filename: z.string().min(1),
        // Base64 encoded string (without data: prefix)
        file: z.string().min(1),
      })
    )
    .mutation(async (opts) => {
      const { filename, file } = opts.input;

      // If the client sent a data URL, strip the prefix
      const base64 = file.includes("base64,")
        ? file.split("base64,").pop()!
        : file;

      const buffer = Buffer.from(base64, "base64");

      const blob = await put(`${opts.ctx.workspace.slug}/${filename}`, buffer, {
        access: "public",
      });

      return blob;
    }),
});
