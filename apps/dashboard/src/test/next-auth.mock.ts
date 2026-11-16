// Test double for next-auth, swapped in via --import-map. Importing the real
// entry pulls in next/server and next/headers, which Deno cannot resolve inside
// node_modules because next ships no package.json "exports". next-auth itself
// re-exports AuthError from @auth/core/errors, so the class stays identical.
export { AuthError } from "@auth/core/errors";
