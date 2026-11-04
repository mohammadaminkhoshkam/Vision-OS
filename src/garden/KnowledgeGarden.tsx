// Knowledge Garden: each collection is a planter, each paper a flower. A flower opens as the
// paper is read; nothing ever wilts (the progress display can be switched off in Settings).
import { useMemo } from 'react';
import type { MarginalPaper } from '../platform';
import { Decor, type DecorKind } from './plants';
import type { DecorItem } from './gardenState';
import { fromPhoto } from './GardenScene';

const PALETTE = ['#b8423a', '#efe6d2', '#d9a441', '#8a2a3a', '#c86a3a', '#e8d6a8'];

export function paperProgress(p: MarginalPaper) {
  if (p.status === 'read' || p.status === 'done' || p.status === 'reviewed' || p.status === 'implemented') return 1;
  if (!p.pages) return 0;
  return Math.min(1, (p.maxPage || p.lastPage || 0) / p.pages);
}

function Bloom({ p, color, favorite }: { p: number; color: string; favorite: boolean }) {
  if (p < 0.08) {
    return (
      <g>
        <ellipse cx={0} cy={-6} rx={7} ry={11} fill="#6aa456" />
        <path d="M-5,-12 q5,-12 10,0 q-5,4 -10,0z" fill={color} />
      </g>
    );
  }
  const n = p >= 0.9 ? 8 : 5;
  const len = 13 + p * 15;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <ellipse key={i} cx={0} cy={-len * 0.55} rx={len * 0.38} ry={len * 0.6} fill={color} transform={`rotate(${(360 / n) * i})`} opacity={0.95} />
      ))}
      <circle r={len * 0.32} fill={favorite ? '#fff6d0' : '#f6d26b'} />
      {p >= 0.9 && <circle r={len * 0.12} fill="#c38f2f" />}
    </g>
  );
}

/** Central lit planter (reference design): a long stone box with a warm LED strip, the paper
 *  flowers growing along it, and the gold «Library» button on its front face. */
export const PLANTER = { x0: 720, x1: 1400, top: 652, bottom: 728 };

function PlanterLeaves() {
  // a hedge of broad leaves and a few red anthuriums so the box never looks empty
  const leaves = [
    [740, -20, 0.9], [790, 15, 1.1], [850, -35, 0.8], [905, 25, 1.2], [965, -10, 0.9], [1150, 20, 1.1], [1210, -30, 0.9], [1265, 10, 1.2], [1320, -25, 1], [1375, 20, 0.9],
  ];
  return (
    <g>
      {leaves.map(([x, r, s], i) => (
        <g key={i} transform={`translate(${x} ${PLANTER.top}) rotate(${r}) scale(${s})`}>
          <path d="M0,0 C-22,-10 -28,-46 -6,-62 C-2,-64 2,-64 6,-62 C28,-46 22,-10 0,0 Z" fill={i % 3 ? '#2b5230' : '#376a3a'} />
          <path d="M0,-2 V-58" stroke="#1d3a20" strokeWidth={2} />
        </g>
      ))}
      {[[880, -70], [1235, -64], [1300, -78]].map(([x, h], i) => (
        <g key={i} transform={`translate(${x} ${PLANTER.top})`}>
          <path d={`M0,0 Q4,${h / 2} 0,${h}`} stroke="#2b5230" strokeWidth={2.5} fill="none" />
          <path d={`M0,${h} c-14,-8 -16,-24 0,-20 c16,-4 14,12 0,20z`} fill="#b3232e" />
          <path d={`M0,${h - 4} l2,-14`} stroke="#f1cd84" strokeWidth={2.5} strokeLinecap="round" />
        </g>
      ))}
    </g>
  );
}

function LibraryButton({ onOpen, at }: { onOpen: () => void; at?: { x: number; y: number } }) {
  const cx = at?.x ?? (PLANTER.x0 + PLANTER.x1) / 2, cy = at?.y ?? (PLANTER.top + PLANTER.bottom) / 2 + 6;
  return (
    <g className="library-btn" data-vt role="button" aria-label="Library" onClick={onOpen} transform={`translate(${cx} ${cy})`}>
      <rect x={-112} y={-26} width={224} height={52} rx={10} fill="url(#libGold)" stroke="#f1cd84" strokeWidth={1.5} filter="url(#libShadow)" />
      <rect x={-108} y={-22} width={216} height={44} rx={8} fill="none" stroke="#fff6dc" strokeOpacity={0.35} />
      <g transform="translate(58 -13) scale(1.1)" fill="none" stroke="#2a2010" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5c.8 0 1.5-.7 1.5-1.5z" />
      </g>
      <text x={-18} y={8} textAnchor="middle" fontSize={23} fontWeight={700} fill="#2a2010" fontFamily="var(--font)">
        Library
      </text>
    </g>
  );
}

export function KnowledgeGarden({
  papers,
  showProgress,
  onOpen,
  onHover,
  onLibrary,
  photo,
  active,
}: {
  papers: MarginalPaper[];
  showProgress: boolean;
  onOpen: (p: MarginalPaper) => void;
  onHover: (p: MarginalPaper | null, el: Element | null) => void;
  onLibrary: () => void;
  /** photographic background: the planter is in the photo, papers become glowing seed lights */
  photo?: boolean;
  /** the paper in the current session: lit up and labelled so the garden mirrors the work */
  active?: { id: string; page?: number } | null;
}) {
  const props = { papers, showProgress, onOpen, onHover, onLibrary, activeId: active?.id, activePage: active?.page };
  return photo ? <PhotoGarden {...props} /> : <PaintedGarden {...props} />;
}

type GardenProps = {
  papers: MarginalPaper[];
  showProgress: boolean;
  onOpen: (p: MarginalPaper) => void;
  onHover: (p: MarginalPaper | null, el: Element | null) => void;
  onLibrary: () => void;
  activeId?: string | null;
  /** page from the live session, fresher than Marginal's record */
  activePage?: number;
};

/** Over the photo: each paper is a glowing seed light floating above the planter's plants,
 *  brighter as it is read; a finished paper opens into a small bloom. The paper in the current
 *  session is ringed and labelled with its page, so the scene reflects what you are working on. */
function PhotoGarden({ papers, showProgress, onOpen, onHover, onLibrary, activeId, activePage }: GardenProps) {
  // the active paper always gets a place, the middle one, where its label stays clear of the panels
  const active = activeId ? papers.find(p => p.id === activeId) : undefined;
  const rest = papers.filter(p => p !== active).slice(0, active ? 11 : 12);
  const list = active ? [...rest.slice(0, Math.floor(rest.length / 2)), active, ...rest.slice(Math.floor(rest.length / 2))] : rest;
  const a = fromPhoto(560, 0).x, b = fromPhoto(1090, 0).x;
  return (
    <g className="kgarden photo">
      <defs>
        <radialGradient id="seedGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset="0.35" stopColor="#ffd27a" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="libGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6e3b4" />
          <stop offset="1" stopColor="#d2ac63" />
        </linearGradient>
        <filter id="libShadow" x="-20%" y="-40%" width="140%" height="190%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000" floodOpacity="0.55" />
        </filter>
      </defs>
      {list.map((p, i) => {
        const prog = showProgress ? paperProgress(p) : 1;
        const x = a + ((b - a) * (i + 0.5)) / list.length;
        const y = fromPhoto(0, 520 - ((i * 53) % 70)).y;
        const on = p.id === activeId;
        const r = (9 + prog * 9) * (on ? 1.25 : 1);
        const bloom = showProgress && prog >= 0.9;
        const page = (on && activePage) || p.lastPage || p.maxPage;
        return (
          <g
            key={p.id}
            className={`kflower seed ${on ? 'active' : ''} ${bloom ? 'bloomed' : ''}`}
            data-vt
            role="button"
            aria-label={p.title}
            onClick={() => onOpen(p)}
            onMouseEnter={e => onHover(p, e.currentTarget)}
            onMouseLeave={() => onHover(null, null)}
            style={{ animationDelay: `-${i * 0.9}s` }}
          >
            <circle cx={x} cy={y} r={r * 3.2} fill="url(#seedGlow)" opacity={0.55 + prog * 0.35} />
            {bloom ? (
              <g transform={`translate(${x} ${y}) scale(0.62)`}>
                <Bloom p={1} color={p.favorite ? '#fffaf0' : '#f2c9a0'} favorite={p.favorite} />
              </g>
            ) : (
              <circle cx={x} cy={y} r={r * 0.42} fill="#fff6d6" />
            )}
            {on && (
              <>
                <circle className="seed-ring" cx={x} cy={y} r={r * 1.6} fill="none" stroke="#f1cd84" strokeWidth={1.5} />
                <g className="seed-tag" transform={`translate(${x} ${y - r * 2.4})`} pointerEvents="none">
                  <rect x={-92} y={-30} width={184} height={34} rx={8} fill="rgba(8,20,15,0.86)" stroke="rgba(241,205,132,0.55)" />
                  <text y={-16} textAnchor="middle" fontSize={12} fontWeight={600} fill="#f5f0e5" fontFamily="var(--font)">
                    {p.title.length > 28 ? p.title.slice(0, 27) + '…' : p.title}
                  </text>
                  <text y={-2} textAnchor="middle" fontSize={10.5} fill="#f1cd84" fontFamily="var(--font)">
                    {page ? `page ${page}${p.pages ? ` of ${p.pages}` : ''}` : 'in progress'}
                  </text>
                </g>
              </>
            )}
            <circle cx={x} cy={y} r={30} fill="transparent" />
          </g>
        );
      })}
      <LibraryButton onOpen={onLibrary} at={fromPhoto(822, 652)} />
    </g>
  );
}

function PaintedGarden({ papers, showProgress, onOpen, onHover, onLibrary, activeId }: GardenProps) {
  const beds = useMemo(() => {
    const groups = new Map<string, MarginalPaper[]>();
    for (const p of papers) {
      const k = p.collection || '';
      groups.set(k, [...(groups.get(k) ?? []), p]);
    }
    return [...groups.entries()].slice(0, 4);
  }, [papers]);

  const { x0, x1, top, bottom } = PLANTER;
  // flowers are planted in the two halves either side of the library button
  const slots = useMemo(() => {
    const all = beds.flatMap(([name, list], bi) => list.slice(0, 6).map(p => ({ p, bi, name })));
    const left = all.filter((_, i) => i % 2 === 0), right = all.filter((_, i) => i % 2 === 1);
    const place = (arr: typeof all, a: number, b: number) => arr.map((s, i) => ({ ...s, x: a + ((b - a) * (i + 0.5)) / Math.max(1, arr.length) }));
    return [...place(left, x0 + 40, 930), ...place(right, 1190, x1 - 40)];
  }, [beds, x0, x1]);

  return (
    <g className="kgarden">
      <defs>
        <linearGradient id="stone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6e6455" />
          <stop offset="1" stopColor="#3b342b" />
        </linearGradient>
        <linearGradient id="libGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6e3b4" />
          <stop offset="1" stopColor="#d2ac63" />
        </linearGradient>
        <radialGradient id="planterGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffbf5e" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffbf5e" stopOpacity="0" />
        </radialGradient>
        <filter id="libShadow" x="-20%" y="-40%" width="140%" height="190%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000" floodOpacity="0.55" />
        </filter>
        <filter id="ledGlow" x="-5%" y="-400%" width="110%" height="900%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      {/* warm light spilling on the floor and up into the leaves */}
      <ellipse cx={(x0 + x1) / 2} cy={bottom + 18} rx={(x1 - x0) / 2 + 120} ry={46} fill="url(#planterGlow)" />
      <ellipse cx={(x0 + x1) / 2} cy={top - 40} rx={(x1 - x0) / 2} ry={90} fill="url(#planterGlow)" opacity={0.55} style={{ mixBlendMode: 'screen' }} />
      <PlanterLeaves />
      {slots.map(({ p, bi, x }, i) => {
        const h = 70 + ((i * 37) % 44);
        const prog = showProgress ? paperProgress(p) : 1;
        const color = PALETTE[bi % PALETTE.length];
        return (
          <g key={p.id} className={`kflower ${p.id === activeId ? 'active' : ''}`} data-vt role="button" aria-label={p.title} onClick={() => onOpen(p)} onMouseEnter={e => onHover(p, e.currentTarget)} onMouseLeave={() => onHover(null, null)}>
            <path d={`M${x},${top} Q${x + (i % 2 ? 8 : -8)},${top - h / 2} ${x},${top - h}`} stroke="#3a6b35" strokeWidth={3.5} fill="none" />
            <path d={`M${x},${top - 24} q${i % 2 ? 16 : -16},-6 ${i % 2 ? 20 : -20},-20 q${i % 2 ? -12 : 12},2 ${i % 2 ? -20 : 20},20z`} fill="#3f7038" />
            <g transform={`translate(${x},${top - h})`}>
              <circle r={30} fill="transparent" />
              {p.id === activeId && <circle className="seed-ring" r={34} fill="none" stroke="#f1cd84" strokeWidth={2} />}
              <Bloom p={prog} color={p.favorite ? '#fffaf0' : color} favorite={p.favorite} />
            </g>
          </g>
        );
      })}
      {/* the stone box */}
      <rect x={x0} y={top + 6} width={x1 - x0} height={bottom - top - 6} rx={4} fill="url(#stone)" />
      <rect x={x0 - 8} y={top - 4} width={x1 - x0 + 16} height={12} rx={3} fill="#8c7f6b" />
      <rect x={x0 - 4} y={top - 8} width={x1 - x0 + 8} height={6} rx={3} fill="#2a2018" />
      <line x1={x0 + 6} x2={x1 - 6} y1={top + 9} y2={top + 9} stroke="#ffd27a" strokeWidth={6} filter="url(#ledGlow)" className="led" />
      <line x1={x0 + 6} x2={x1 - 6} y1={top + 9} y2={top + 9} stroke="#ffe7b0" strokeWidth={1.5} opacity={0.9} />
      <rect x={x0} y={top + 10} width={x1 - x0} height={22} fill="url(#planterGlow)" opacity={0.6} />
      {/* brass plaques for named collections */}
      {beds
        .filter(([name]) => name)
        .map(([name], i, arr) => {
          const px = x0 + 80 + ((x1 - x0 - 160) * (i + 0.5)) / arr.length;
          if (Math.abs(px - (x0 + x1) / 2) < 150) return null;
          return (
            <g key={name} transform={`translate(${px} ${bottom - 22})`}>
              <rect x={-56} y={-11} width={112} height={22} rx={4} fill="#b08a3e" />
              <text y={5} textAnchor="middle" fontSize={12} fill="#1d160b" fontFamily="var(--font)" fontWeight={700}>
                {name.length > 14 ? name.slice(0, 13) + '…' : name}
              </text>
            </g>
          );
        })}
      <LibraryButton onOpen={onLibrary} />
    </g>
  );
}
export function DecorLayer({
  items,
  editing,
  selected,
  careSim,
  thirsty,
  ghost,
  onPointerDown,
  onInspect,
}: {
  items: DecorItem[];
  editing: boolean;
  selected: string | null;
  careSim: boolean;
  thirsty: (d: DecorItem) => boolean;
  ghost: null | { x: number; y: number; ok: boolean; kind: DecorKind; color?: string };
  onPointerDown: (id: string, e: React.PointerEvent) => void;
  onInspect: (id: string) => void;
}) {
  return (
    <g className={editing ? 'decor editing' : 'decor'}>
      {[...items]
        .sort((a, b) => a.y - b.y)
        .map(it => (
          <g
            key={it.id}
            transform={`translate(${it.x},${it.y})`}
            data-decor={it.id}
            data-vt=""
            role="button"
            aria-label="Plant"
            onPointerDown={editing ? e => onPointerDown(it.id, e) : undefined}
            onClick={editing ? undefined : () => onInspect(it.id)}
            style={{ cursor: editing ? 'grab' : 'pointer' }}
          >
            <ellipse cx={0} cy={2} rx={34} ry={7} fill="#000" opacity={0.18} />
            <Decor kind={it.kind} color={it.color} />
            {careSim && thirsty(it) && (
              <g transform="translate(22,-40)">
                <path d="M0,-10 C5,-3 7,1 7,4 A7,7 0 0 1 -7,4 C-7,1 -5,-3 0,-10 Z" fill="#7cc8ff" stroke="#1d3a22" strokeWidth={1.5} />
              </g>
            )}
            {editing && selected === it.id && <circle r={8} cy={10} fill="#d6b46a" stroke="#1d160b" strokeWidth={2} />}
          </g>
        ))}
      {ghost && (
        <g transform={`translate(${ghost.x},${ghost.y})`} opacity={0.6} pointerEvents="none" className={ghost.ok ? 'ghost ok' : 'ghost bad'}>
          <ellipse cx={0} cy={2} rx={40} ry={9} fill={ghost.ok ? '#8fe07a' : '#e05a5a'} opacity={0.6} />
          <Decor kind={ghost.kind} color={ghost.color} />
        </g>
      )}
    </g>
  );
}