// Semantic discovery (after Reor): which papers, highlights and board cards belong together.
// It works offline by default with TF-IDF over everything you have written or clipped about a
// paper, and every suggested connection carries its evidence (the shared terms), so the user can
// see why two papers were linked. When a local embedding model is available in Ollama, «deep
// match» blends in embedding similarity; nothing leaves the computer either way.

const STOP = new Set(
  'a an and are as at be been but by can for from has have in into is it its of on or our over such than that the their them then there these they this to under was we were what when which while with within without using use used via based study paper approach method results show new two one also between both each more most other some can may not via towards toward model models analysis survey ieee proceedings journal conference'.split(' '),
);

export function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? [])
    .map(w => w.replace(/(ies)$/, 'y').replace(/(ing|ed|es|s)$/, ''))
    .filter(w => w.length > 2 && !STOP.has(w));
}

export interface DocText {
  id: string;
  text: string;
}

type Vec = Map<string, number>;

export function tfidf(docs: DocText[]): Map<string, Vec> {
  const tf = docs.map(d => {
    const m: Vec = new Map();
    for (const t of tokens(d.text)) m.set(t, (m.get(t) ?? 0) + 1);
    return m;
  });
  const df = new Map<string, number>();
  for (const m of tf) for (const t of m.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const n = docs.length;
  const out = new Map<string, Vec>();
  docs.forEach((d, i) => {
    const v: Vec = new Map();
    let norm = 0;
    for (const [t, c] of tf[i]) {
      // terms found in every document say nothing about relatedness
      const w = (1 + Math.log(c)) * Math.log((n + 1) / (df.get(t)! + 0.5));
      if (w > 0) (v.set(t, w), (norm += w * w));
    }
    norm = Math.sqrt(norm) || 1;
    for (const [t, w] of v) v.set(t, w / norm);
    out.set(d.id, v);
  });
  return out;
}

export function cosine(a: Vec, b: Vec) {
  let s = 0;
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  for (const [t, w] of small) s += w * (big.get(t) ?? 0);
  return s;
}

export function sharedTerms(a: Vec, b: Vec, k = 4) {
  return [...a.keys()]
    .filter(t => b.has(t))
    .sort((x, y) => a.get(y)! * b.get(y)! - a.get(x)! * b.get(x)!)
    .slice(0, k);
}

export interface Relation {
  a: string;
  b: string;
  score: number;
  /** evidence shown to the user */
  terms: string[];
}

export function relations(docs: DocText[], opts: { min?: number; perDoc?: number; embed?: Map<string, number[]> } = {}): Relation[] {
  const { min = 0.12, perDoc = 3, embed } = opts;
  const vec = tfidf(docs);
  const all: Relation[] = [];
  for (let i = 0; i < docs.length; i++)
    for (let j = i + 1; j < docs.length; j++) {
      const va = vec.get(docs[i].id)!, vb = vec.get(docs[j].id)!;
      let score = cosine(va, vb);
      const ea = embed?.get(docs[i].id), eb = embed?.get(docs[j].id);
      if (ea && eb) score = Math.max(score, 0.5 * score + 0.5 * dense(ea, eb));
      if (score >= min) all.push({ a: docs[i].id, b: docs[j].id, score, terms: sharedTerms(va, vb) });
    }
  // keep only each document's strongest few links so the map stays readable
  all.sort((x, y) => y.score - x.score);
  const count = new Map<string, number>();
  return all.filter(r => {
    const ca = count.get(r.a) ?? 0, cb = count.get(r.b) ?? 0;
    if (ca >= perDoc || cb >= perDoc) return false;
    count.set(r.a, ca + 1);
    count.set(r.b, cb + 1);
    return true;
  });
}

function dense(a: number[], b: number[]) {
  let s = 0, na = 0, nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) (s += a[i] * b[i]), (na += a[i] * a[i]), (nb += b[i] * b[i]);
  return s / (Math.sqrt(na * nb) || 1);
}

export const relatedTo = (rels: Relation[], id: string) =>
  rels.filter(r => r.a === id || r.b === id).map(r => ({ id: r.a === id ? r.b : r.a, score: r.score, terms: r.terms }));
