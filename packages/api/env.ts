import { copyFile } from "node:fs/promises";

await copyFile("./.env.test", "./.env");
