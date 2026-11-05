// Discovery state: relations between papers in the library, computed from titles, collections,
// highlights and board clips; optionally deepened with a local Ollama embedding model.
import { useMemo } from 'react';
import { appData } from '../apps/data';
import { ollama } from '../ai/ollama';
import { board } from '../board/store';
import { createStore, loadJson, saveJson } from '../lib/store';
import { loadNotes } from '../reader/annotations';
import { toast } from '../state/app';
import { relations, type DocText, type Relation } from './related';

const KEY = 'vos.embed';
const cached = loadJson<{ model: string | null; vectors: Record<string, number[]> }>(KEY, { model: null, vectors: {} });

export const discovery = createStore({ model: cached.model, vectors: cached.vectors, running: false });

export function paperTexts(): DocText[] {
  const nodes = board.get().doc.nodes;
  return appData.get().papers.map(p => {
    const notes = loadNotes(`m-${p.id}`);
    const clips = nodes.filter(n => n.source?.kind === 'pdf' && n.source.paperId === p.id).map(n => n.text);
    return { id: p.id, text: [p.title, p.title, p.collection, ...notes.highlights.map(h => h.text), ...clips].join('. ') };
  });
}

/** Relations for the current library; recomputed when papers or the board change. */
export function useRelations(): Relation[] {
  const papers = appData.use(s => s.papers);
  const nodes = board.use(s => s.doc.nodes);
  const vectors = discovery.use(s => s.vectors);
  return useMemo(() => {
    const docs = paperTexts();
    const embed = new Map(Object.entries(vectors));
    return relations(docs, { embed: embed.size ? embed : undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [papers, nodes, vectors]);
}

export const currentRelations = () => {
  const embed = new Map(Object.entries(discovery.get().vectors));
  return relations(paperTexts(), { embed: embed.size ? embed : undefined });
};

/** User-initiated: embed every paper with a local embedding model, if one is installed. */
export async function deepMatch() {
  const st = await ollama.status();
  if (!st.ok) return toast('Ollama is not running; related papers use offline term matching', 'warn');
  const model = st.models.find(m => /embed|bge|e5|minilm/i.test(m.name))?.name;
  if (!model) return toast('Install a local embedding model first (for example: ollama pull nomic-embed-text)', 'warn');
  discovery.set({ running: true });
  try {
    const docs = paperTexts();
    const vecs = await ollama.embed(model, docs.map(d => d.text.slice(0, 4000)));
    const vectors = Object.fromEntries(docs.map((d, i) => [d.id, vecs[i]]).filter(([, v]) => Array.isArray(v)));
    discovery.set({ model, vectors });
    saveJson(KEY, { model, vectors });
    toast(`Deep match ready (${model})`, 'ok');
  } catch (e) {
    toast(`Deep match failed: ${e instanceof Error ? e.message : e}`, 'warn');
  } finally {
    discovery.set({ running: false });
  }
}

const KNOWN = 'vos.knownPapers';

/** When a new paper appears in the library, suggest how it connects to earlier work (once). */
export function watchNewPapers() {
  let known = new Set(loadJson<{ ids: string[] }>(KNOWN, { ids: [] }).ids);
  let first = known.size === 0;
  return appData.subscribe(() => {
    const { papers, loaded } = appData.get();
    if (!loaded || !papers.length) return;
    const fresh = papers.filter(p => !known.has(p.id));
    if (!fresh.length) return;
    known = new Set(papers.map(p => p.id));
    saveJson(KNOWN, { ids: [...known] });
    if (first) return void (first = false); // the first run only learns the library
    const rels = currentRelations();
    for (const p of fresh.slice(0, 3)) {
      const best = rels.filter(r => r.a === p.id || r.b === p.id).sort((x, y) => y.score - x.score)[0];
      if (!best) continue;
      const other = papers.find(x => x.id === (best.a === p.id ? best.b : best.a));
      if (other) toast(`New paper «${p.title.slice(0, 40)}» connects to «${other.title.slice(0, 40)}» (${best.terms.slice(0, 2).join(', ')})`, 'ok');
    }
  });
}
