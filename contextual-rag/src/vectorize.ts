import { createChunk } from "./db";

export async function contextualizeChunks(env: { AI: Ai }, content: string, chunks: string[]): Promise<string[]> {
  const promises = chunks.map(async c => {

    const prompt = `<document> 
${content} 
</document> 
Here is the chunk we want to situate within the whole document 
<chunk> 
${c}
</chunk> 
Please give a short succinct context to situate this chunk within the overall document for the purposes of improving search retrieval of the chunk. Answer only with the succinct context and nothing else. `;

    // @ts-ignore
    const res = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fast", {
      prompt,
    }) as { response: string }

    return `${res.response}; ${c}`;
  })

  return await Promise.all(promises);
}


export async function insertChunkVectors(
  env: { D1: D1Database, AI: Ai, VECTORIZE: Vectorize },
  data: { docId: string, created: Date },
  chunks: string[],
) {

  const { docId, created } = data;
  const batchSize = 10;
  const insertPromises = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const chunkBatch = chunks.slice(i, i + batchSize);

    insertPromises.push(
      (async () => {
        const embeddingResult = await env.AI.run("@cf/baai/bge-large-en-v1.5", {
          text: chunkBatch,
        });
        const embeddingBatch: number[][] = embeddingResult.data;

        const chunkInsertResults = await Promise.all(chunkBatch.map(c => createChunk(env, { docId, text: c })))
        const chunkIds = chunkInsertResults.map((result) => result.id);

        await env.VECTORIZE.insert(
          embeddingBatch.map((embedding, index) => ({
            id: chunkIds[index],
            values: embedding,
            metadata: {
              docId,
              chunkId: chunkIds[index],
              text: chunkBatch[index],
              timestamp: created.getTime(),
            },
          }))
        );
      })()
    );
  }

  await Promise.all(insertPromises);
}


export async function queryChunkVectors(env: { AI: Ai, VECTORIZE: Vectorize }, params: { queries: string[], timeframe?: { from?: number, to?: number } }) {
  const { queries, timeframe, } = params;
  const queryVectors = await Promise.all(
    queries.map((q) => env.AI.run("@cf/baai/bge-large-en-v1.5", { text: [q] }))
  );

  const filter: VectorizeVectorMetadataFilter = {  };
  if (timeframe?.from) {
    // @ts-expect-error error in the package
    filter.timestamp = { "$gte": timeframe.from }
  }
  if (timeframe?.to) {
    // @ts-expect-error error in the package
    filter.timestamp = { "$lt": timeframe.to }
  }

  const results = await Promise.all(
    queryVectors.map((qv) =>
      env.VECTORIZE.query(qv.data[0], {
        topK: 20,
        returnValues: false,
        returnMetadata: "all",
        filter,
      })
    )
  );

  return results;
}
