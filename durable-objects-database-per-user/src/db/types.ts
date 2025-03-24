import type { DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import type * as schema from "./schemas";
import { notes } from "./notes";

export type DB = DrizzleSqliteDODatabase<typeof schema>;

export type Note = typeof notes.$inferSelect;
export type InsertNote = typeof notes.$inferInsert;