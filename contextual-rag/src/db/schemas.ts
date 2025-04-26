import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const docs = sqliteTable(
  "docs",
  {
    id: text("id")
      .notNull()
      .primaryKey()
      .$defaultFn(() => randomString()),
    contents: text("contents"),
    created: integer("created", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    updated: integer("updated", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ([
    index("docs.created.idx").on(table.created),
  ]),
);


export const chunks = sqliteTable(
  "chunks",
  {
    id: text("id")
      .notNull()
      .primaryKey()
      .$defaultFn(() => randomString()),
    docId: text('doc_id').notNull(),
    text: text("text").notNull(),
    created: integer("created", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => ([
    index("chunks.doc_id.idx").on(table.docId),
  ]),
);

function randomString(length = 16): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const resultArray = new Array(length);

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    resultArray[i] = chars[randomIndex];
  }

  return resultArray.join("");
}
