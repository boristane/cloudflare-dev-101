import { queryChunkVectors } from "./vectorize";
import { getChunk, searchChunks } from "./db";
import { performReciprocalRankFusion } from "./utils";
import { generateObject, type LanguageModel } from "ai";
import { z } from "zod"

type DocSearchParams = {
  query: string,
  questions: string[];
  keywords: string[];
  scoreThreshold?: number;
  topK?: number;
  timeframe?: {
    from?: number;
    to?: number;
  };
}

type SearchBindings = {
  AI: Ai,
  VECTORIZE: Vectorize,
  D1: D1Database,
}

export async function searchDocs(env: SearchBindings, params: DocSearchParams): Promise<{ chunks: Array<{ text: string, id: string, docId: string; score: number }> }> {
  const { timeframe, questions, keywords } = params;

  const [vectors, sql] = (await Promise.all([
    queryChunkVectors(env, { queries: questions, timeframe, },),
    searchChunks(env, { needles: keywords, timeframe }),
  ]));

  const searchResults = {
    vectors,
    sql: sql.map(item => {
      return {
        id: item.id,
        text: item.text,
        docId: item.doc_id,
        rank: item.rank,
      }
    })
  };

  const mergedResults = performReciprocalRankFusion(searchResults.sql, searchResults.vectors);
  const res = await processSearchResults(env, params, mergedResults);
  return res;
}



async function processSearchResults(env: SearchBindings, params: DocSearchParams, mergedResults: { docId: string, id: string; score: number; text?: string }[]) {
  if (!mergedResults.length) return { chunks: [] };
  const { query, scoreThreshold, topK } = params;
  const chunks: Array<{ text: string; id: string; docId: string } & { score: number }> = [];

  const response = await env.AI.run(
    "@cf/baai/bge-reranker-base",
    {
      // @ts-ignore
      query,
      contexts: mergedResults.map(r => ({ id: r.id, text: r.text }))
    },
  ) as { response: Array<{ id: number, score: number }> };


  const scores = response.response.map(i => i.score);
  let indices = response.response.map((i, index) => ({ id: i.id, score: sigmoid(scores[index]) }));
  if (scoreThreshold && scoreThreshold > 0) {
    indices = indices.filter(i => i.score >= scoreThreshold);
  }
  if (topK && topK > 0) {
    indices = indices.slice(0, topK)
  }

  const slice = reorderArray(mergedResults, indices.map(i => i.id)).map((v, index) => ({ ...v, score: indices[index]?.score }));

  await Promise.all(slice.map(async result => {
    if (!result) return;
    const a = {
      text: result.text || (await getChunk(env, { docId: result.docId, id: result.id }))?.text || "",
      docId: result.docId,
      id: result.id,
      score: result.score,
    };

    chunks.push(a)
  }));

  return { chunks };
}

function reorderArray<T>(source: T[], indices: number[]): T[] {
  const result: T[] = [];

  for (let i = 0; i < indices.length; i++) {
    const index = indices[i];
    result.push(source[index]);
  }

  return result;
}


export async function rewriteToQueries(model: LanguageModel, params: { prompt: string }): Promise<{ keywords: string[], queries: string[] }> {
  const prompt = `Given the following user message, rewrite it into 5 distinct queries that could be used to search for relevant information, and provide additional keywords related to the query.
Each query should focus on different aspects or potential interpretations of the original message.
Each keyword should be a derived from an interpratation of the provided user message.

User message: ${params.prompt}`;

  try {
    const res = await generateObject({
      model,
      prompt,
      schema: z.object({
        queries: z.array(z.string()).describe(
          "Similar queries to the user's query. Be concise but comprehensive."
        ),
        keywords: z.array(z.string()).describe(
          "Keywords from the query to use for full-text search"
        ),
      }),
    })

    return res.object;
  } catch (err) {
    return {
      queries: [params.prompt],
      keywords: []
    }
  }
}

function sigmoid(score: number, k: number = 0.4): number {
  return 1 / (1 + Math.exp(-score / k));
}

