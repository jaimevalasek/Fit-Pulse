import { defineConfig } from "prisma/config";
import { resolveDatabaseUrl } from "./server/db/databaseUrl.ts";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: resolveDatabaseUrl(),
  },
});
