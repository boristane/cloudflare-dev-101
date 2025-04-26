
interface DocMatch {
  id: string;
  docId: string;
  text: string;
  rank: number;
}

export function performReciprocalRankFusion(
  fullTextResults: DocMatch[],
  vectorResults: VectorizeMatches[]
): { docId: string,  id: string; score: number; text?: string }[] {

  const vectors = uniqueVectorMatches(vectorResults.flatMap(r => r.matches));
  const sql = uniqueDocMatches(fullTextResults);

  const k = 60; // Constant for fusion, can be adjusted
  const vectorPenalty = 1; // full text search are more relevant than vector
  const scores: { [key: string]: { id: string, text?: string;  docId: string, score: number } } = {};

  // Process full-text search results
  sql.forEach((result, index) => {
    const key = result.id;
    const score = 1 / (k + index);
    scores[key] = {
      id: result.id,
      docId: result.docId,
      text: result.text,
      score: (scores[key]?.score || 0) + score,
    };
  });

  // Process vector search results
  vectors.forEach((match, index) => {
    const key = match.id;
    const score = 1 / (vectorPenalty * k + index);
    scores[key] = {
      id: match.id,
      docId: match.metadata?.docId as string,
      text: match.metadata?.text as string,
      score: (scores[key]?.score || 0) + score,
    };
  });

  const res = Object.entries(scores)
    .map(([key, { id, score, docId, text }]) => ({ docId, id, score, text }))
    .sort((a, b) => b?.score - a?.score);

  return res.slice(0, 150);
}

export function uniqueVectorMatches(items: VectorizeMatch[]): Array<VectorizeMatch & { count: number; }> {
  const groups = new Map<string, VectorizeMatch & { count: number }>();

  for (const item of items) {
    const key = `${item.namespace}_${item.id}`;
    const group = groups.get(key);
    if (!group) {
      groups.set(key, {
        ...item,
        count: 1
      });
    } else {
      group.score += item.score;
      group.count += 1;
    }
  }

  const result = Array.from(groups.values()).map(group => ({
    ...group,
    score: group.score / group.count
  }));

  const res = result.sort((a, b) => b.score - a.score);
  return res;
}


function uniqueDocMatches(items: DocMatch[]): Array<DocMatch & { count: number }> {
  const groups = new Map();

  for (const item of items) {
    const key = `${item.docId}_${item.id}`;
    const group = groups.get(key);

    if (!group) {
      groups.set(key, {
        ...item,
        count: 1,
      });
    } else {
      group.rankSum += item.rank;
      group.count += 1;
    }
  }

  const result = Array.from(groups.values()).map(group => ({
    ...group,
    rank: group.rankSum / group.count,
  }));

  return result.sort((a, b) => Math.abs(b.rank) - Math.abs(a.rank));
}


export function reorderRerankedArray<T>(source: T[], indices: number[]): T[] {
  const result: T[] = [];

  for (let i = 0; i < indices.length; i++) {
    const index = indices[i];
    result.push(source[index]);
  }

  return result;
}
