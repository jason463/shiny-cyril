import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  migrate: {
    adapter: async () => {
      const { default: Database } = await import("better-sqlite3");
      const { PrismaBetterSQLite3 } = await import(
        "@prisma/adapter-better-sqlite3"
      );
      const db = new Database(path.join(__dirname, "prisma", "dev.db"));
      return new PrismaBetterSQLite3(db);
    },
  },
  datasource: {
    url: "file:" + path.join(__dirname, "prisma", "dev.db"),
  },
});
