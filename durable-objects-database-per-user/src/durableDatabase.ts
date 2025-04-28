import { DurableObject } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/durable-sqlite';
import { migrate } from 'drizzle-orm/durable-sqlite/migrator';
import { Bindings } from '../bindings';
import migrations from '../drizzle/migrations';
import * as notes from "./db/index";
import * as schema from "./db/schemas";

import { DB } from './db/types';

export class DurableDatabase extends DurableObject {
    db: DB;

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
        migrate(this.db, migrations);
    }
}

export function getDurableDatabaseStub(env: Bindings, userId: string) {
    const doId = env.DurableDatabase.idFromName(userId);
    return env.DurableDatabase.get(doId);
}

