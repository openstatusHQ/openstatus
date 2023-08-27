import { fileURLToPath } from "url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig(() => {
  //   import.meta.env.DATABASE_URL =
  //     "postgres://postgres:postgres@localhost:5432/postgres";
  return {
    test: {
      setupFiles: "dotenv/config", // load variables form .env file
      globals: true,
      exclude: [...configDefaults.exclude, "**/playwright/**"],
      alias: {
        "~/": fileURLToPath(new URL("./src/", import.meta.url)),
      },
    },
  };
});
