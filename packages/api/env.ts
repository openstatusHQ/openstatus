const file = Bun.file("./.env.test");
await Bun.write("./.env", file);
