import { DurableObject } from "cloudflare:workers";
import type { Bindings } from "../bindings";
import { migrations } from "../migrations";
import { migrate } from "./migrate";

export interface Node {
  id: string;
  type: string;
  data: Record<string, any>;
  createdBy: string;
  lastEditedBy: string;
  created: Date;
  updated: Date;
}

export interface Edge {
  source: string;
  target: string;
  relationship: string;
  properties?: Record<string, any>;
  createdBy: string;
  lastEditedBy: string;
  created: Date;
  updated: Date;
}

export interface InsertNode {
  id: string;
  type: string;
  data: Record<string, any>;
  userId: string;
}

export interface InsertEdge {
  source: string;
  target: string;
  relationship: string;
  properties?: Record<string, any>;
  userId: string;
}

type DBNode = {
  id: string;
  type: string;
  data: string;
  created_by: string;
  last_edited_by: string;
  created: number;
  updated: number;
};

type DBEdge = {
  source: string;
  target: string;
  relationship: string;
  properties: string | null;
  created_by: string;
  last_edited_by: string;
  created: number;
  updated: number;
};

export class GraphDatabase extends DurableObject {
  private db: SqlStorage;

  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    this.db = ctx.storage.sql;

    this.ctx.blockConcurrencyWhile(async () => {
      migrate(ctx.storage, migrations);
    });
  }

  // Node operations
  addNode(node: InsertNode): Node {
    const { id, type, data, userId } = node;
    const result = this.db.exec(
      "INSERT OR REPLACE INTO nodes (id, type, data, created_by, last_edited_by, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *",
      id,
      type,
      JSON.stringify(data),
      userId,
      userId,
      Date.now(),
      Date.now()
    );

    const rows = result.toArray() as Array<DBNode>;
    const row = rows[0];
    if (!row) throw new Error("Failed to insert node");

    return toNode(row);
  }

  findNode(id: string): Node | null {
    const result = this.db.exec("SELECT * FROM nodes WHERE id = ?", id);
    const res = result.toArray();
    if (!res.length) {
      return null;
    }

    const rows = res as Array<DBNode>;
    const row = rows[0];
    if (!row) return null;

    return toNode(row);
  }

  findNodes(filters?: { type?: string; limit?: number; offset?: number }): Node[] {
    let query = "SELECT * FROM nodes";
    const params: any[] = [];

    if (filters?.type) {
      query += " WHERE type = ?";
      params.push(filters.type);
    }

    if (filters?.limit) {
      query += " LIMIT ?";
      params.push(filters.limit);
    }

    if (filters?.offset) {
      query += " OFFSET ?";
      params.push(filters.offset);
    }

    const result = this.db.exec(query, ...params);
    const res = result.toArray();

    return res.map((row) => toNode(row as DBNode));
  }

  deleteNode(id: string): Node | null {
    // First delete all edges connected to this node
    this.db.exec("DELETE FROM edges WHERE source = ? OR target = ?", id, id);

    // Then delete the node
    const result = this.db.exec("DELETE FROM nodes WHERE id = ? RETURNING *", id);
    const res = result.toArray();
    if (!res.length) {
      return null;
    }

    const rows = res as Array<DBNode>;
    const row = rows[0];
    if (!row) return null;

    return toNode(row);
  }

  // Edge operations
  connectNodes(edge: InsertEdge): Edge {
    const { source, target, relationship, properties, userId } = edge;
    const result = this.db.exec(
      "INSERT OR REPLACE INTO edges (source, target, relationship, properties, created_by, last_edited_by, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
      source,
      target,
      relationship,
      properties ? JSON.stringify(properties) : null,
      userId,
      userId,
      Date.now(),
      Date.now()
    );

    const rows = result.toArray() as Array<DBEdge>;
    const typedRow = rows[0];
    if (!typedRow) throw new Error("Failed to insert edge");

    return toEdge(typedRow);
  }

  disconnectNodes(source: string, target: string, relationship: string): Edge | null {
    const result = this.db.exec(
      "DELETE FROM edges WHERE source = ? AND target = ? AND relationship = ? RETURNING *",
      source,
      target,
      relationship
    );

    const res = result.toArray();
    if (!res.length) {
      return null;
    }

    const rows = res as Array<DBEdge>;
    const row = rows[0];
    if (!row) return null;

    return toEdge(row);
  }

  findEdges(filters?: { nodeId?: string; relationship?: string }): Edge[] {
    let query = "SELECT * FROM edges";
    const params: any[] = [];
    const conditions: string[] = [];

    if (filters?.nodeId) {
      conditions.push("(source = ? OR target = ?)");
      params.push(filters.nodeId, filters.nodeId);
    }

    if (filters?.relationship) {
      conditions.push("relationship = ?");
      params.push(filters.relationship);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    const result = this.db.exec(query, ...params);
    const res = result.toArray();

    return res.map((row) => toEdge(row as DBEdge));
  }

  // Graph traversal operations
  findNeighbors(
    nodeId: string,
    direction: "inbound" | "outbound" | "both" = "both"
  ): string[] {
    let query: string;
    const params: string[] = [];

    switch (direction) {
      case "inbound":
        query = "SELECT DISTINCT source AS neighbor FROM edges WHERE target = ?";
        params.push(nodeId);
        break;
      case "outbound":
        query = "SELECT DISTINCT target AS neighbor FROM edges WHERE source = ?";
        params.push(nodeId);
        break;
      case "both":
      default:
        query = `
          SELECT DISTINCT target AS neighbor FROM edges WHERE source = ?
          UNION
          SELECT DISTINCT source AS neighbor FROM edges WHERE target = ?
        `;
        params.push(nodeId, nodeId);
        break;
    }

    const result = this.db.exec(query, ...params);
    const res = result.toArray();
    return res.map((row) => (row as { neighbor: string }).neighbor);
  }

  traverse(
    startNodeId: string,
    options: {
      endNodeId?: string;
      maxDepth?: number;
      direction?: "inbound" | "outbound" | "both";
    } = {}
  ): { found: boolean; path?: string[]; depth?: number; reachableNodes?: string[]; count?: number } {
    const { endNodeId, maxDepth = 50, direction = "both" } = options;

    const visited = new Set<string>();
    const queue: Array<{ id: string; path: string[]; depth: number }> = [
      { id: startNodeId, path: [startNodeId], depth: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.depth > maxDepth) continue;

      if (endNodeId && current.id === endNodeId) {
        return {
          found: true,
          path: current.path,
          depth: current.depth,
        };
      }

      if (visited.has(current.id)) continue;
      visited.add(current.id);

      const neighbors = this.findNeighbors(current.id, direction);

      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          queue.push({
            id: neighborId,
            path: [...current.path, neighborId],
            depth: current.depth + 1,
          });
        }
      }
    }

    if (endNodeId) {
      return {
        found: false,
        path: [],
        depth: 0,
      };
    }

    return {
      found: true,
      reachableNodes: Array.from(visited),
      count: visited.size,
    };
  }

  getStats(): {
    totalNodes: number;
    totalEdges: number;
    nodesByType: Record<string, number>;
    edgesByRelationship: Record<string, number>;
  } {
    const nodesResult = this.db.exec("SELECT type FROM nodes");
    const edgesResult = this.db.exec("SELECT relationship FROM edges");

    const nodes = nodesResult.toArray() as Array<{ type: string }>;
    const edges = edgesResult.toArray() as Array<{ relationship: string }>;

    const nodesByType: Record<string, number> = {};
    for (const node of nodes) {
      nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
    }

    const edgesByRelationship: Record<string, number> = {};
    for (const edge of edges) {
      edgesByRelationship[edge.relationship] =
        (edgesByRelationship[edge.relationship] || 0) + 1;
    }

    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      nodesByType,
      edgesByRelationship,
    };
  }
}


export function safeParse(data: string | null): Record<string, any> {
  if (!data) return {};
  try {
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

function toNode(row: DBNode): Node {
  return {
    id: row.id,
    type: row.type,
    data: safeParse(row.data),
    createdBy: row.created_by,
    lastEditedBy: row.last_edited_by,
    created: new Date(row.created),
    updated: new Date(row.updated),
  };
}

function toEdge(row: DBEdge): Edge {
  return {
    source: row.source,
    target: row.target,
    relationship: row.relationship,
    properties: row.properties ? safeParse(row.properties) : undefined,
    createdBy: row.created_by,
    lastEditedBy: row.last_edited_by,
    created: new Date(row.created),
    updated: new Date(row.updated),
  };
}

