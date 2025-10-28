export default {
  version: 0,
  name: "add_graph_tables",
  sql: `
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    data TEXT NOT NULL,
    created_by TEXT NOT NULL,
    last_edited_by TEXT NOT NULL,
    updated INTEGER NOT NULL,
    created INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS nodes_type_idx ON nodes(type);
CREATE INDEX IF NOT EXISTS nodes_created_by_idx ON nodes(created_by);

CREATE TABLE IF NOT EXISTS edges (
    source TEXT NOT NULL,
    target TEXT NOT NULL,
    relationship TEXT NOT NULL,
    properties TEXT,
    created_by TEXT NOT NULL,
    last_edited_by TEXT NOT NULL,
    updated INTEGER NOT NULL,
    created INTEGER NOT NULL,
    UNIQUE(source, target, relationship)
);

CREATE INDEX IF NOT EXISTS edges_source_idx ON edges(source);
CREATE INDEX IF NOT EXISTS edges_target_idx ON edges(target);
CREATE INDEX IF NOT EXISTS edges_relationship_idx ON edges(relationship);
  `,
};
