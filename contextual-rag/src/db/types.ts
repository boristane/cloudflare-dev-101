import { docs, chunks } from "./schemas";

export type Doc = typeof docs.$inferSelect;
export type InsertDoc = typeof docs.$inferInsert;

export type Chunk = typeof chunks.$inferSelect;
export type InsertChunk = typeof chunks.$inferInsert;
