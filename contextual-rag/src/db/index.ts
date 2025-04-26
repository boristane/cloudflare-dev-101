import { and, eq, inArray } from "drizzle-orm";
import { InsertDoc, Doc, Chunk, InsertChunk } from "./types";

import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schemas";
import { docs, chunks } from "./schemas";
interface DB { D1: D1Database }

export function getDrizzleClient(env: DB) {
  return drizzle(env.D1, {
    schema,
  });
}

export async function createDoc(env: DB, doc: InsertDoc): Promise<Doc> {
  const d1 = getDrizzleClient(env);

  const [res] = await d1
    .insert(docs)
    .values(doc)
    .onConflictDoUpdate({
      target: [docs.id],
      set: doc,
    })
    .returning();

  return res;
}

export async function getDoc(env: DB, params: { id: string }): Promise<Doc | null> {
  const d1 = getDrizzleClient(env);

  const [result] = await d1
    .select()
    .from(docs)
    .where(eq(docs.id, params.id));
  if (!result) return null;
  return result;
}


export async function listDocsByIds(
  env: DB,
  params: { ids: string[] },
): Promise<Doc[]> {
  const d1 = getDrizzleClient(env);

  const qs = await d1
    .select()
    .from(docs)
    .where(inArray(docs.id, params.ids))
  return qs;
}


type ChunkSearch = Omit<Chunk, "docId" | "created"> & { doc_id: string; rank: number }

export async function searchChunks(env: DB, params: { needles: string[], timeframe?: { from?: number, to?: number }; }, limit = 40) {
  const d1 = getDrizzleClient(env);

  const { needles, timeframe } = params;
  const queries = needles.filter(Boolean).map(
    (term) => {
      const sanitizedTerm = term.trim().replace(/[^\w\s]/g, '');

      return `
        SELECT chunks.*, bm25(chunks_fts) AS rank
        FROM chunks_fts
        JOIN chunks ON chunks_fts.id = chunks.id
        WHERE chunks_fts MATCH '${sanitizedTerm}'
        ${timeframe?.from ? `AND created > ${timeframe.from}` : ''}
        ${timeframe?.to ? `AND created < ${timeframe.to}` : ''}
        ORDER BY rank
        LIMIT ${limit}
      `;
    }
  );

  const results = await Promise.all(
    queries.map(async (query) => {
      const res = await d1.run(query);
      return res.results as ChunkSearch[];
    })
  );

  return results.flat()
}


export async function createChunk(env: DB, chunk: InsertChunk): Promise<Chunk> {
  const d1 = getDrizzleClient(env);

  const [res] = await d1
    .insert(chunks)
    .values(chunk)
    .onConflictDoUpdate({
      target: [chunks.id],
      set: chunk,
    })
    .returning();

  return res;
}

export async function getChunk(env: DB, params: { docId: string, id: string }): Promise<Chunk | null> {
  const d1 = getDrizzleClient(env);

  const [result] = await d1
    .select()
    .from(chunks)
    .where(and(eq(chunks.docId, params.docId), eq(chunks.id, params.id)));
  if (!result) return null;
  return result;
}

