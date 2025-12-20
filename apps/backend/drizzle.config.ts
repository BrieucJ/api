import env from "./src/env";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./src/migrations",
  schema: "./src/db/models",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});
