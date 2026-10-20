import { createClient } from "@libsql/client";
const a = createClient({ url: "http://127.0.0.1:8090" });
const b = createClient({ url: "http://127.0.0.1:8090" });
await a.execute("create table if not exists t (x int)");
const txA = await a.transaction();
await txA.execute("insert into t values (1)");
const t0 = Date.now();
const txB = await b.transaction();
try {
  await txB.execute("select 1");
  console.log("B started after", Date.now() - t0, "ms (no busy)");
} catch (e) {
  console.log("B failed after", Date.now() - t0, "ms:", e.code, e.message);
}
setTimeout(async () => {
  await txA.rollback();
  console.log("A released at", Date.now() - t0);
}, 3000);
