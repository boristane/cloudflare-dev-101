import { DurableObject } from 'cloudflare:workers';
import { Hono } from 'hono'
import { Bindings } from '../bindings';
import { drizzle } from 'drizzle-orm/durable-sqlite';
import { migrate } from 'drizzle-orm/durable-sqlite/migrator';
import migrations from '../drizzle/migrations';
import * as schema from "./db/schemas";
import * as notes from "./db/index";

import { DB } from './db/types';

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', async (c) => {
  return c.json({ message: "Hello World!" })
});

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },
};

async function getDurableDatabaseStub(env: Bindings, userId: string) {
  const doId = env.DurableDatabase.idFromName(userId);
  return await env.DurableDatabase.get(doId);
} 

// Create a note for a user
app.post('/:userId', async (c) => {
  const userId = c.req.param("userId");
  const { text } = await c.req.json();
  const stub = await getDurableDatabaseStub(c.env, userId);
  const note = await stub.notesCreate({ text });
  return c.json({ note })
});

// List all notes for a user
app.get('/:userId', async (c) => {
  const userId = c.req.param("userId");
  const stub = await getDurableDatabaseStub(c.env, userId);
  const notes = await stub.notesList()
  return c.json({ notes })
});

// Get a specific note for a user
app.get('/:userId/:noteId', async (c) => {
  const userId = c.req.param("userId");
  const noteId = c.req.param("noteId");
  const stub = await getDurableDatabaseStub(c.env, userId);
  const note = await stub.notesGet({ id: noteId });
  if (!note) {
    return c.notFound();
  }
  return c.json({ note })
});

// Delete a note for a user
app.delete('/:userId/:noteId', async (c) => {
  const userId = c.req.param("userId");
  const noteId = c.req.param("noteId");
  const stub = await getDurableDatabaseStub(c.env, userId);
  const note = await stub.notesDel({ id: noteId });
  return c.json({ note })
});

export class DurableDatabase extends DurableObject {
  private db: DB;
  
  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    // Initialize Drizzle with the Durable Object's storage
    this.db = drizzle(ctx.storage, { schema, logger: true });
    
    // Run migrations before accepting any requests
    ctx.blockConcurrencyWhile(async () => {
      await this._migrate();
    });
  }

  async notesCreate(note: Parameters<typeof notes.create>[1]): ReturnType<typeof notes.create> {
    return await notes.create(this.db, note);
  }

  async notesGet(params: Parameters<typeof notes.get>[1]): ReturnType<typeof notes.get> {
    return await notes.get(this.db, params);
  }

  async notesList(): ReturnType<typeof notes.list> {
    return await notes.list(this.db);
  }

  async notesDel(params: Parameters<typeof notes.get>[1]): ReturnType<typeof notes.del> {
    return await notes.del(this.db, params);
  }

  private async _migrate() {
    await migrate(this.db, migrations);
  }
}
