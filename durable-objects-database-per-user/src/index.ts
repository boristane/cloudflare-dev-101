import { Hono } from 'hono';
import { Bindings } from '../bindings';
import { DurableDatabase, getDurableDatabaseStub } from './durableDatabase';
export { DurableDatabase } from './durableDatabase';

// Add a type for the variables stored in the Hono context
type Variables = {
  stub: DurableObjectStub;
};

const STUB = 'stub';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.get('/', async (c) => {
  return c.json({ message: "Hello World!" })
});

app.use('/:userId/*', async (c, next) => {
  const userId = c.req.param("userId");
  const stub = getDurableDatabaseStub(c.env, userId);
  c.set(STUB, stub);
  await next();
});

// Create a note for a user
app.post('/:userId', async (c) => {
  const { text } = await c.req.json();
  const stub = c.get(STUB) as DurableObjectStub<DurableDatabase>;
  const note = await stub.notesCreate({ text });
  return c.json({ note })
});

// List all notes for a user
app.get('/:userId', async (c) => {
  const stub = c.get(STUB) as DurableObjectStub<DurableDatabase>;
  const notes = await stub.notesList()
  return c.json({ notes })
});

// Get a specific note for a user
app.get('/:userId/:noteId', async (c) => {
  const noteId = c.req.param("noteId");
  const stub = c.get(STUB) as DurableObjectStub<DurableDatabase>;
  const note = await stub.notesGet({ id: noteId });
  if (!note) {
    return c.notFound();
  }
  return c.json({ note })
});

// Delete a note for a user
app.delete('/:userId/:noteId', async (c) => {
  const noteId = c.req.param("noteId");
  const stub = c.get(STUB) as DurableObjectStub<DurableDatabase>;
  const note = await stub.notesDel({ id: noteId });
  return c.json({ note })
});

export default app;