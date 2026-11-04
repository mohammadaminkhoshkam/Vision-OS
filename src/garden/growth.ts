// Personal research journey: the garden grows from meaningful progress, never from clicks or the
// mere passing of time. Finishing a paper, annotating it properly, linking it into the knowledge
// map, naming a connection and focused hours all count; nothing ever wilts.

export interface PaperFacts {
  id: string;
  collection: string;
  progress: number; // 0..1
  highlights: number;
  /** board cards clipped from this paper */
  clips: number;
  lastTouched: number; // ms, 0 if never
}

export interface JourneyFacts {
  papers: PaperFacts[];
  labelledLinks: number;
  focusMinutes: number;
}

export const STAGES = [
  { name: 'Seedbed', at: 0 },
  { name: 'Sprouting', at: 15 },
  { name: 'Growing', at: 40 },
  { name: 'Flourishing', at: 90 },
  { name: 'Mature garden', at: 180 },
] as const;

export interface Journey {
  points: number;
  stage: number;
  name: string;
  /** points needed for the next stage (null at the last one) */
  next: number | null;
  /** progress inside the current stage, 0..1 */
  within: number;
  finished: number;
  annotated: number;
  mapped: number;
}

export const isAnnotated = (p: PaperFacts) => p.highlights >= 3;
export const isMapped = (p: PaperFacts) => p.clips > 0;

export function journey(f: JourneyFacts): Journey {
  const finished = f.papers.filter(p => p.progress >= 0.95).length;
  const annotated = f.papers.filter(isAnnotated).length;
  const mapped = f.papers.filter(isMapped).length;
  const clips = f.papers.reduce((s, p) => s + Math.min(p.clips, 10), 0);
  const points = finished * 10 + annotated * 3 + mapped * 2 + clips + f.labelledLinks * 2 + Math.floor(f.focusMinutes / 30);
  let stage = 0;
  STAGES.forEach((s, i) => points >= s.at && (stage = i));
  const next = STAGES[stage + 1]?.at ?? null;
  const within = next === null ? 1 : (points - STAGES[stage].at) / (next - STAGES[stage].at);
  return { points, stage, name: STAGES[stage].name, next, within, finished, annotated, mapped };
}

export interface Project {
  name: string;
  papers: number;
  progress: number;
  lastTouched: number;
  /** the paper to continue in this project */
  resumeId: string | null;
}

/** Each collection is a bed in the garden: a project with its own memory. */
export function projects(papers: PaperFacts[]): Project[] {
  const groups = new Map<string, PaperFacts[]>();
  for (const p of papers) groups.set(p.collection || 'Unsorted', [...(groups.get(p.collection || 'Unsorted') ?? []), p]);
  return [...groups.entries()]
    .map(([name, list]) => {
      const touched = [...list].sort((a, b) => b.lastTouched - a.lastTouched);
      const open = touched.find(p => p.progress < 0.95) ?? touched[0];
      return { name, papers: list.length, progress: list.reduce((s, p) => s + p.progress, 0) / list.length, lastTouched: touched[0].lastTouched, resumeId: open?.id ?? null };
    })
    .sort((a, b) => b.lastTouched - a.lastTouched || b.papers - a.papers);
}

/** Fireflies drifting over the planter: more as the garden matures (Living Garden). */
export const fireflies = (stage: number) => 4 + stage * 5;
