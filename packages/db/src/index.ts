export * as schema from "./schema";
export { relations } from "./schema/relations";
export * from "drizzle-orm";
export { SQLiteAsyncTransaction } from "drizzle-orm/sqlite-core";
export * from "./db";
// doing this because the external module not working see : https://github.com/vercel/next.js/issues/43433
// export * from "./sync-db";
