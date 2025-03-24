import { eq } from "drizzle-orm";
import { notes } from "./notes";
import { DB, InsertNote, Note } from "./types";

export async function create(db: DB, note: InsertNote): Promise<Note> {
  const [res] = await db
    .insert(notes)
    .values(note)
    .onConflictDoUpdate({
      target: [notes.id],
      set: note,
    })
    .returning();

  return res;
}

export async function del(db: DB, params: { id: string }): Promise<Note> {
  const [note] = await db
    .delete(notes)
    .where(eq(notes.id, params.id))
    .returning();
  return note;
}

export async function get(db: DB, params: { id: string }): Promise<Note | null> {
  const [result] = await db
    .select()
    .from(notes)
    .where(eq(notes.id, params.id));
  if (!result) return null;
  return result;
}

export async function list(db: DB): Promise<Note[]> {
  const ns = await db
    .select()
    .from(notes)
  return ns;
}
