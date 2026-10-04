// Local QA helper only. Never deploy this permissive PostgreSQL wire server.
import { PGlite } from "@electric-sql/pglite";
import { createServer } from "pglite-server";
import { readdir, readFile } from "node:fs/promises";
const db = new PGlite();
await db.waitReady;
for (const migration of (await readdir("db/migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort())
  await db.exec(await readFile("db/migrations/" + migration, "utf8"));
const server = createServer(db);
server.listen(5544, "127.0.0.1", () =>
  console.log("QA database ready on loopback:5544"),
);
process.on("SIGTERM", () => server.close(() => db.close()));
