import { defineConfig } from "drizzle-kit";

// TODO supply those variables in .env
if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
  throw Error("");
}

if (!process.env.CLOUDFLARE_API_TOKEN) {
  throw Error("");
}

export default defineConfig({
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    databaseId: getDatabaseId(),
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    token: process.env.CLOUDFLARE_API_TOKEN,
  },
  schema: "./src/db/schemas.ts",
  out: "./drizzle",
});

function getDatabaseId() {
  // TODO replace with your database ID
  return "6198de3b-a806-4c30-992f-36b97de26463";
}
