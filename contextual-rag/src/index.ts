import { Hono } from 'hono'
import { Bindings } from '../bindings';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { contextualizeChunks, insertChunkVectors } from './vectorize';
import { createDoc, listDocsByIds } from './db';
import { createWorkersAI } from 'workers-ai-provider';
import { rewriteToQueries, searchDocs } from './search';

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', async (c) => {
  return c.json({ message: "Hello World!" })
});

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },
};


app.post('/', async (c) => {
  const { contents } = await c.req.json();
  if (!contents || typeof contents !== "string") return c.json({ message: "Bad Request" }, 400)

  const doc = await createDoc(c.env, { contents });

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1024,
    chunkOverlap: 200,
  });
  const raw = await splitter.splitText(contents);
  const chunks = await contextualizeChunks(c.env, contents, raw)
  await insertChunkVectors(c.env, { docId: doc.id, created: doc.created }, chunks);

  return c.json(doc)
});

app.post('/query', async (c) => {
  const { prompt, timeframe } = await c.req.json();


  if (!prompt) return c.json({ message: "Bad Request" }, 400);

  const searchOptions: {
    timeframe?: { from?: number; to?: number };
  } = {};

  if (timeframe) {
    searchOptions.timeframe = timeframe;
  }

  const ai = createWorkersAI({ binding: c.env.AI });
  // @ts-ignore
  const model = ai("@cf/meta/llama-3.1-8b-instruct-fast") as LanguageModel;


  const { queries, keywords } = await rewriteToQueries(model, { prompt });

  const { chunks } = await searchDocs(c.env, {
    questions: queries,
    query: prompt,
    keywords,
    topK: 8,
    scoreThreshold: 0.501,
    ...searchOptions,
  });

  const uniques = getUniqueListBy(chunks, "docId").map((r) => {
    const arr = chunks
      .filter((f) => f.docId === r.docId)
      .map((v) => v.score);
    return {
      id: r.docId,
      score: Math.max(...arr),
    };
  });

  const res = await listDocsByIds(c.env, { ids: uniques.map(u => u.id) });
  const answer = await c.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
    prompt: `${prompt}
    
Context: ${chunks}`
  })

  return c.json({
    keywords,
    queries,
    chunks,
    answer,
    docs: res.map(doc => ({ ...doc, score: uniques.find(u => u.id === doc.id)?.score || 0 })).sort((a, b) => b.score - a.score)
  })
});

function getUniqueListBy<T extends Record<string, unknown>>(arr: T[], key: keyof T): T[] {
  const result: T[] = [];
  for (const elt of arr) {
    const found = result.find((t) => t[key] === elt[key]);
    if (!found) {
      result.push(elt);
    }
  }
  return result;
}