const file = Bun.file("./.env.example");
await Bun.write("./.env", file);
