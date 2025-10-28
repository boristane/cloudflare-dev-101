import { Hono } from "hono";
import { cors } from "hono/cors";

import type { Bindings } from "../bindings";
import type { InsertNode, InsertEdge } from "./do";

const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", cors());

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const apiRequest = new Request(request.url.replace("/api", ""), request);
      return app.fetch(apiRequest, env, ctx);
    }

    return env.ASSETS.fetch(request);
  },
};

export { GraphDatabase } from "./do";

function getGraphDatabaseStub(env: Bindings, graphId: string) {
  const doId = env.GraphDatabase.idFromName(graphId);
  return env.GraphDatabase.get(doId);
}

// Node endpoints
app.post("/:graphId/nodes", async (c) => {
  const graphId = c.req.param("graphId");
  const body = await c.req.json<InsertNode>();
  const stub = getGraphDatabaseStub(c.env, graphId);
  const node = await stub.addNode(body);
  return c.json({ node });
});

app.get("/:graphId/nodes/:nodeId", async (c) => {
  const graphId = c.req.param("graphId");
  const nodeId = c.req.param("nodeId");
  const stub = getGraphDatabaseStub(c.env, graphId);
  const node = await stub.findNode(nodeId);
  if (!node) {
    return c.json({ error: "Node not found" }, 404);
  }
  return c.json({ node });
});

app.get("/:graphId/nodes", async (c) => {
  const graphId = c.req.param("graphId");
  const type = c.req.query("type");
  const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!) : undefined;
  const offset = c.req.query("offset")
    ? parseInt(c.req.query("offset")!)
    : undefined;

  const stub = getGraphDatabaseStub(c.env, graphId);
  const nodes = await stub.findNodes({ type, limit, offset });
  return c.json({ nodes, count: nodes.length });
});

app.delete("/:graphId/nodes/:nodeId", async (c) => {
  const graphId = c.req.param("graphId");
  const nodeId = c.req.param("nodeId");
  const stub = getGraphDatabaseStub(c.env, graphId);
  const node = await stub.deleteNode(nodeId);
  if (!node) {
    return c.json({ error: "Node not found" }, 404);
  }
  return c.json({ node });
});

// Edge endpoints
app.post("/:graphId/edges", async (c) => {
  const graphId = c.req.param("graphId");
  const body = await c.req.json<InsertEdge>();
  const stub = getGraphDatabaseStub(c.env, graphId);
  const edge = await stub.connectNodes(body);
  return c.json({ edge });
});

app.get("/:graphId/edges", async (c) => {
  const graphId = c.req.param("graphId");
  const nodeId = c.req.query("nodeId");
  const relationship = c.req.query("relationship");
  const stub = getGraphDatabaseStub(c.env, graphId);
  const edges = await stub.findEdges({ nodeId, relationship });
  return c.json({ edges, count: edges.length });
});

app.delete("/:graphId/edges/:source/:relationship/:target", async (c) => {
  const graphId = c.req.param("graphId");
  const source = c.req.param("source");
  const target = c.req.param("target");
  const relationship = c.req.param("relationship");
  const stub = getGraphDatabaseStub(c.env, graphId);
  const edge = await stub.disconnectNodes(source, target, relationship);
  if (!edge) {
    return c.json({ error: "Edge not found" }, 404);
  }
  return c.json({ edge });
});

// Graph operations
app.get("/:graphId/nodes/:nodeId/neighbors", async (c) => {
  const graphId = c.req.param("graphId");
  const nodeId = c.req.param("nodeId");
  const direction = (c.req.query("direction") as "inbound" | "outbound" | "both") || "both";

  const stub = getGraphDatabaseStub(c.env, graphId);
  const neighbors = await stub.findNeighbors(nodeId, direction);
  return c.json({ neighbors, count: neighbors.length });
});

app.post("/:graphId/traverse", async (c) => {
  const graphId = c.req.param("graphId");
  const { startNodeId, endNodeId, maxDepth, direction } = await c.req.json<{
    startNodeId: string;
    endNodeId?: string;
    maxDepth?: number;
    direction?: "inbound" | "outbound" | "both";
  }>();

  const stub = getGraphDatabaseStub(c.env, graphId);
  const result = await stub.traverse(startNodeId, {
    endNodeId,
    maxDepth,
    direction,
  });
  return c.json(result);
});

app.get("/:graphId/stats", async (c) => {
  const graphId = c.req.param("graphId");
  const stub = getGraphDatabaseStub(c.env, graphId);
  const stats = await stub.getStats();
  return c.json(stats);
});
