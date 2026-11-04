// The research journey made visible: a Home card (stage, what made the garden grow, projects with
// their own memory and mood) and fireflies over the planter that multiply as the garden matures.
import { useEffect, useMemo } from 'react';
import { appData } from '../apps/data';
import { board } from '../board/store';
import { focus } from '../focus/store';
import { loadJson, saveJson } from '../lib/store';
import { loadNotes } from '../reader/annotations';
import { app, setPrefs, toast, type Preset } from '../state/app';
import { resumeActivity } from '../state/resume';
import { relativeTime, workspace } from '../state/workspace';
import { Icon } from '../ui/icons';
import { fireflies, journey, projects, type PaperFacts } from './growth';
import { paperProgress, PLANTER } from './KnowledgeGarden';
import { fromPhoto } from './GardenScene';

export function usePaperFacts(): PaperFacts[] {
  const papers = appData.use(s => s.papers);
  const nodes = board.use(s => s.doc.nodes);
  const recent = workspace.use(s => s.recent);
  return useMemo(
    () =>
      papers.map(p => ({
        id: p.id,
        collection: p.collection,
        progress: paperProgress(p),
        highlights: loadNotes(`m-${p.id}`).highlights.length,
        clips: nodes.filter(n => n.source?.kind === 'pdf' && n.source.paperId === p.id).length,
        lastTouched: recent.find(a => a.kind === 'paper' && a.id === p.id)?.at ?? (Date.parse(p.opened) || 0),
      })),
    [papers, nodes, recent],
  );
}

export function useJourney() {
  const facts = usePaperFacts();
  const labelled = board.use(s => s.doc.edges.filter(e => e.label).length);
  const sessions = focus.use(s => s.sessions);
  const focusMinutes = useMemo(() => sessions.filter(s => s.status === 'completed').reduce((a, s) => a + s.activeMs / 60000, 0), [sessions]);
  return useMemo(() => ({ ...journey({ papers: facts, labelledLinks: labelled, focusMinutes }), facts }), [facts, labelled, focusMinutes]);
}

// ───────────── project moods: a scene preset remembered per collection
const MOODS_KEY = 'vos.projectMoods';
const PRESETS: { id: Preset; label: string }[] = [
  { id: 'photo', label: 'Night greenhouse' },
  { id: 'morning', label: 'Morning' },
  { id: 'rainy', label: 'Rain' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'night', label: 'Painted night' },
];
export const projectMoods = () => loadJson<Record<string, Preset>>(MOODS_KEY, {});

/** Opening a paper from a project with a chosen mood brings that environment back. */
export function applyProjectMood(collection: string) {
  const mood = projectMoods()[collection || 'Unsorted'];
  if (mood && app.get().preset !== mood) setPrefs({ preset: mood });
}

export function JourneyCard() {
  const j = useJourney();
  const list = projects(j.facts).slice(0, 3);
  const papers = appData.use(s => s.papers);
  const now = Date.now();

  // a new stage is a small celebration, once
  const loaded = appData.use(s => s.loaded && s.papers.length > 0);
  useEffect(() => {
    if (!loaded) return; // judge growth only once the library is known
    const seen = loadJson<{ stage: number }>('vos.journey', { stage: -1 }).stage;
    if (seen >= 0 && j.stage > seen) {
      toast(`Your garden reached «${j.name}» 🌱`, 'ok');
      document.documentElement.dataset.bloom = '1';
      setTimeout(() => delete document.documentElement.dataset.bloom, 2600);
    }
    if (j.stage !== seen) saveJson('vos.journey', { stage: j.stage });
  }, [j.stage, j.name, loaded]);

  if (!papers.length) return null;
  return (
    <section className="card hcard journey">
      <header className="card-h">
        <Icon name="leaf" />
        <h3>Research journey</h3>
        <span className="card-src">{j.name}</span>
      </header>
      <div className="jr-bar" aria-label={j.next === null ? 'Fully grown' : `${j.points} of ${j.next} growth points`}>
        <span style={{ width: `${Math.round(j.within * 100)}%` }} />
      </div>
      <p className="jr-stats">
        {j.finished} finished · {j.annotated} well annotated · {j.mapped} on the board
        {j.next !== null && <> · {j.next - j.points} to the next stage</>}
      </p>
      <ul className="jr-projects">
        {list.map(p => {
          const mood = projectMoods()[p.name];
          return (
            <li key={p.name}>
              <button
                className="jr-project"
                onClick={() => {
                  const paper = papers.find(x => x.id === p.resumeId);
                  if (paper) void resumeActivity({ kind: 'paper', id: paper.id, title: paper.title, page: paper.lastPage, at: now });
                }}
                title="Continue this project"
              >
                <span className="jr-name" dir="auto">
                  {p.name}
                </span>
                <small>
                  {p.papers} paper{p.papers === 1 ? '' : 's'} · {Math.round(p.progress * 100)}%{p.lastTouched ? ` · ${relativeTime(p.lastTouched, now)}` : ''}
                </small>
              </button>
              <select
                className="jr-mood"
                value={mood ?? ''}
                aria-label={`Mood for ${p.name}`}
                title="Scene that comes back when you work on this project"
                onChange={e => {
                  const m = { ...projectMoods() };
                  if (e.target.value) m[p.name] = e.target.value as Preset;
                  else delete m[p.name];
                  saveJson(MOODS_KEY, m);
                  if (e.target.value) setPrefs({ preset: e.target.value as Preset });
                }}
              >
                <option value="">Any mood</option>
                {PRESETS.map(x => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Fireflies over the planter; their number follows the journey stage. Drawn inside the scene SVG. */
export function GrowthFx({ photo }: { photo: boolean }) {
  const { stage } = useJourney();
  const n = fireflies(stage);
  const x0 = photo ? fromPhoto(520, 0).x : PLANTER.x0, x1 = photo ? fromPhoto(1130, 0).x : PLANTER.x1;
  const y0 = photo ? fromPhoto(0, 380).y : PLANTER.top - 200, y1 = photo ? fromPhoto(0, 600).y : PLANTER.top - 20;
  // deterministic scatter so they do not jump between renders
  const flies = Array.from({ length: n }, (_, i) => {
    const r1 = ((i * 9301 + 49297) % 233280) / 233280, r2 = ((i * 4271 + 1013) % 9973) / 9973;
    return { x: x0 + (x1 - x0) * r1, y: y0 + (y1 - y0) * r2, d: 7 + ((i * 37) % 9), delay: -((i * 1.7) % 9) };
  });
  return (
    <g className={`fireflies stage-${stage}`} pointerEvents="none" aria-hidden>
      {flies.map((f, i) => (
        <circle key={i} cx={f.x} cy={f.y} r={stage >= 3 ? 2.6 : 2.1} className="firefly" style={{ animationDuration: `${f.d}s`, animationDelay: `${f.delay}s` }} />
      ))}
    </g>
  );
}
