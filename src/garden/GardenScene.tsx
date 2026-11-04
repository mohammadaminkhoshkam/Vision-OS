// "Ivy Conservatory": a hand-built SVG greenhouse with dark timber frames, weathered teal iron
// ribs, dense ivy and broad-leaf foliage drawn leaf by leaf, a brick (day) or dark wooden (night) floor. Original artwork,
// mood-matched to the user's own ivy-courtyard wallpaper (no part of it is traced).
import { memo, useMemo, type ReactNode } from 'react';

export const SCENE_W = 1600;
export const SCENE_H = 900;
export const FLOOR_Y = 640;

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// natural greens, from shade to sunlit
const SHADE = ['#16301c', '#1c3a22', '#213f25'];
const DEEP = ['#24472a', '#2b5230', '#2f5a33', '#264c2c'];
const MID = ['#3a6b35', '#437a3b', '#4c8240', '#3f7038'];
const LIGHT = ['#5f9446', '#6b9f4c', '#78a852', '#68984a'];
const SUN = ['#9cc062', '#aacb6c', '#b9d47a', '#8fb65a'];

const WOOD = '#3f2a1c';
const WOOD_LIGHT = '#6b4a30';
const BRASS = '#b08a3e';
const IRON = '#2c5450';

type Clump = { cx: number; cy: number; r: number; n: number };

/** Broad-leaf shrub drawn as many overlapping leaves; lit from the upper left. */
function Foliage({ clumps, seed, shade = 0 }: { clumps: Clump[]; seed: number; shade?: number }) {
  const leaves = useMemo(() => {
    const rand = rng(seed);
    const pick = (a: string[]) => a[Math.floor(rand() * a.length)];
    const out: { x: number; y: number; s: number; rot: number; c: string; k: 'a' | 'b' | 'c' }[] = [];
    for (const k of clumps) {
      const count = k.n * 26;
      for (let i = 0; i < count; i++) {
        const a = rand() * Math.PI * 2, d = Math.pow(rand(), 0.7) * k.r;
        const x = k.cx + Math.cos(a) * d, y = k.cy + Math.sin(a) * d * 0.78;
        // light depends on height within the clump and distance from the upper-left
        const lit = (k.cy - y) / k.r - (x - k.cx) / (k.r * 2.5) + (rand() - 0.5) * 0.9 - shade;
        const c = lit > 0.75 ? pick(SUN) : lit > 0.25 ? pick(LIGHT) : lit > -0.25 ? pick(MID) : lit > -0.7 ? pick(DEEP) : pick(SHADE);
        out.push({ x, y, s: (k.r / 120) * (0.7 + rand() * 0.6), rot: rand() * 360, c, k: rand() < 0.55 ? 'a' : rand() < 0.6 ? 'b' : 'c' });
      }
    }
    // draw shade first so sunlit leaves sit on top
    const order = [...SHADE, ...DEEP, ...MID, ...LIGHT, ...SUN];
    return out.sort((p, q) => order.indexOf(p.c) - order.indexOf(q.c) || p.y - q.y);
  }, [clumps, seed, shade]);
  return (
    <g>
      {clumps.map((k, i) => (
        <ellipse key={i} cx={k.cx} cy={k.cy + k.r * 0.2} rx={k.r * 1.02} ry={k.r * 0.8} fill="#15291a" />
      ))}
      {leaves.map((l, i) => (
        <use key={i} href={`#leaf-${l.k}`} transform={`translate(${l.x.toFixed(1)} ${l.y.toFixed(1)}) rotate(${l.rot.toFixed(0)}) scale(${l.s.toFixed(2)})`} fill={l.c} />
      ))}
    </g>
  );
}

/** Ivy strands hanging from a beam: little heart-shaped leaves along a wavy line. */
function Ivy({ x0, x1, y, seed, maxLen = 260, count = 14 }: { x0: number; x1: number; y: (x: number) => number; seed: number; maxLen?: number; count?: number }) {
  const parts = useMemo(() => {
    const rand = rng(seed);
    const out: { x: number; y: number; s: number; rot: number; c: string }[] = [];
    const vines: string[] = [];
    for (let v = 0; v < count; v++) {
      const sx = x0 + rand() * (x1 - x0);
      const sy = y(sx);
      const len = 40 + rand() * maxLen;
      const amp = 4 + rand() * 8, ph = rand() * 6;
      let d = `M${sx.toFixed(1)},${sy.toFixed(1)}`;
      for (let t = 0; t <= len; t += 9) {
        const px = sx + Math.sin(t / 22 + ph) * amp, py = sy + t;
        d += ` L${px.toFixed(1)},${py.toFixed(1)}`;
        const side = (t / 9) % 2 ? 1 : -1;
        const fade = 1 - t / (len * 1.3);
        out.push({ x: px + side * 5, y: py, s: (0.45 + rand() * 0.35) * fade + 0.15, rot: side * (40 + rand() * 40) + 180, c: [...DEEP, ...MID, ...MID, ...LIGHT][Math.floor(rand() * 12)] });
      }
      vines.push(d);
    }
    return { out, vines };
  }, [x0, x1, y, seed, maxLen, count]);
  return (
    <g>
      {parts.vines.map((d, i) => (
        <path key={i} d={d} stroke="#2a3d22" strokeWidth={1.4} fill="none" opacity={0.8} />
      ))}
      {parts.out.map((l, i) => (
        <use key={i} href="#leaf-ivy" transform={`translate(${l.x.toFixed(1)} ${l.y.toFixed(1)}) rotate(${l.rot.toFixed(0)}) scale(${l.s.toFixed(2)})`} fill={l.c} />
      ))}
    </g>
  );
}

function Palm({ x, y, h, lean = 0, scale = 1 }: { x: number; y: number; h: number; lean?: number; scale?: number }) {
  const topX = x + lean, topY = y - h;
  const fronds = [-160, -130, -100, -70, -40, -10, 20];
  return (
    <g>
      <path d={`M${x - 10 * scale},${y} Q${x + lean * 0.3},${y - h * 0.5} ${topX - 3},${topY} L${topX + 4},${topY} Q${x + lean * 0.3 + 11},${y - h * 0.5} ${x + 10 * scale},${y} Z`} fill="#5e4a33" />
      {Array.from({ length: Math.floor(h / 18) }, (_, i) => {
        const t = i / (h / 18);
        const px = x + lean * t * t, py = y - h * t;
        return <path key={i} d={`M${px - 9 * scale},${py} q${9 * scale},5 ${18 * scale},0`} stroke="#3e3022" strokeWidth={2} fill="none" opacity={0.7} />;
      })}
      {fronds.map((a, i) => {
        const rad = (a * Math.PI) / 180, len = 135 * scale;
        const ex = topX + Math.cos(rad) * len, ey = topY + Math.sin(rad) * len * 0.7 + 40 * scale;
        const mx = topX + Math.cos(rad) * len * 0.5, my = topY + Math.sin(rad) * len * 0.5 - 16 * scale;
        return (
          <g key={i}>
            <path d={`M${topX},${topY} Q${mx},${my} ${ex},${ey}`} stroke="#2a4a26" strokeWidth={3} fill="none" />
            {Array.from({ length: 16 }, (_, j) => {
              const t = (j + 1) / 17;
              const bx = (1 - t) * (1 - t) * topX + 2 * (1 - t) * t * mx + t * t * ex;
              const by = (1 - t) * (1 - t) * topY + 2 * (1 - t) * t * my + t * t * ey;
              const l = 34 * scale * Math.sin(Math.PI * (0.2 + t * 0.7));
              const c = j % 3 === 0 ? '#2f5a33' : j % 3 === 1 ? '#3a6b35' : '#264c2c';
              return <path key={j} d={`M${bx},${by} l${l * 0.25},${l} M${bx},${by} l${-l * 0.35},${l * 0.95}`} stroke={c} strokeWidth={3.2} strokeLinecap="round" />;
            })}
          </g>
        );
      })}
    </g>
  );
}

function Flowers({ seed, x0, x1, y0, y1, n }: { seed: number; x0: number; x1: number; y0: number; y1: number; n: number }) {
  const dots = useMemo(() => {
    const rand = rng(seed);
    const colors = ['#9e2b33', '#b8423a', '#efe6d2', '#d9a441', '#8a2a3a'];
    return Array.from({ length: n }, () => ({ x: x0 + rand() * (x1 - x0), y: y0 + rand() * (y1 - y0), r: 2 + rand() * 3, c: colors[Math.floor(rand() * colors.length)] }));
  }, [seed, x0, x1, y0, y1, n]);
  return (
    <g>
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.c} opacity={0.9} />
      ))}
    </g>
  );
}

/** Glass pendant lamp on a cord, with a warm bulb and a soft halo (night scene). */
function Pendant({ x, y, len }: { x: number; y: number; len: number }) {
  return (
    <g className="pendant">
      <line x1={x} y1={y - len} x2={x} y2={y - 34} stroke="#0d0d0b" strokeWidth={2.5} />
      <circle cx={x} cy={y} r={110} fill="url(#lampHalo)" />
      <rect x={x - 9} y={y - 40} width={18} height={10} rx={2} fill="#2a2214" />
      <rect x={x - 17} y={y - 31} width={34} height={56} rx={9} fill="#ffd27a" opacity={0.28} stroke="#d5a64f" strokeOpacity={0.55} strokeWidth={1.5} />
      <rect x={x - 6} y={y - 18} width={12} height={30} rx={5} fill="#fff1c9" filter="url(#glow)" />
      <rect x={x - 17} y={y + 22} width={34} height={6} rx={2} fill="#2a2214" />
    </g>
  );
}

/** Dark wooden planks in perspective, catching the lamp light. */
function WoodFloor() {
  const rows = [0, 10, 23, 40, 62, 90, 126, 172, 230];
  return (
    <g>
      <rect x="0" y={FLOOR_Y} width={SCENE_W} height={SCENE_H - FLOOR_Y} fill="url(#wood)" />
      {rows.map((dy, i) => (
        <line key={dy} x1="0" x2={SCENE_W} y1={FLOOR_Y + dy} y2={FLOOR_Y + dy} stroke="#1a110a" strokeWidth={1 + i * 0.25} opacity={0.8} />
      ))}
      {rows.slice(0, -1).flatMap((dy, i) =>
        Array.from({ length: 6 + i * 2 }, (_, j) => {
          const yy = FLOOR_Y + dy, h = rows[i + 1] - dy;
          const off = (i % 2 ? 0.5 : 0) + j;
          const xx = (off / (6 + i * 2)) * SCENE_W;
          return <line key={`${i}-${j}`} x1={xx} x2={xx} y1={yy} y2={yy + h} stroke="#1a110a" strokeWidth={1} opacity={0.6} />;
        }),
      )}
    </g>
  );
}

function Arch({ d, night }: { d: string; night?: boolean }) {
  return (
    <g fill="none" strokeLinecap="round">
      <path d={d} stroke="#0c100f" strokeWidth={32} />
      <path d={d} stroke={night ? '#161b1a' : IRON} strokeWidth={26} />
      <path d={d} stroke={night ? '#3a3f3a' : '#3e6c66'} strokeWidth={night ? 3 : 6} opacity={0.8} />
      <path d={d} stroke={BRASS} strokeWidth={2} strokeDasharray="3 22" />
    </g>
  );
}

function Pillar({ x, top }: { x: number; top: number }) {
  return (
    <g>
      <rect x={x - 14} y={top} width={28} height={FLOOR_Y - top} fill="url(#timber)" />
      <rect x={x - 20} y={top - 10} width={40} height={14} rx={2} fill={BRASS} />
      <rect x={x - 18} y={FLOOR_Y - 16} width={36} height={16} rx={2} fill="#2a1c12" />
      {Array.from({ length: Math.floor((FLOOR_Y - top - 40) / 60) }, (_, i) => (
        <rect key={i} x={x - 15} y={top + 30 + i * 60} width={30} height={3} fill="#2a1c12" opacity={0.6} />
      ))}
    </g>
  );
}

function Motes({ night }: { night: boolean }) {
  const motes = useMemo(() => {
    const rand = rng(night ? 77 : 41);
    return Array.from({ length: night ? 26 : 14 }, () => ({ x: 200 + rand() * 1300, y: 150 + rand() * 600, r: night ? 2 + rand() * 2 : 1.2 + rand() * 1.8, d: 10 + rand() * 12, delay: -rand() * 20 }));
  }, [night]);
  return (
    <g className="motes">
      {motes.map((m, i) => (
        <circle key={i} cx={m.x} cy={m.y} r={m.r} fill={night ? '#ffd27a' : '#fff6d8'} opacity={night ? 1 : 0.7} style={{ animationDuration: `${m.d}s`, animationDelay: `${m.delay}s` }} filter={night ? 'url(#glow)' : undefined} />
      ))}
    </g>
  );
}

/** Large foreground monstera-like leaf on a stem; sways slowly. */
function BigLeaf({ x, y, rot, s, cls, c = '#24472a' }: { x: number; y: number; rot: number; s: number; cls: string; c?: string }) {
  return (
    <g className={cls} style={{ transformOrigin: `${x}px ${y}px` }} transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <path d="M0,0 Q10,-120 0,-210" stroke="#1d3a20" strokeWidth={7} fill="none" />
      <path d="M0,-200 C-110,-230 -150,-330 -60,-420 C-20,-450 20,-450 60,-420 C150,-330 110,-230 0,-200 Z" fill={c} />
      <path d="M0,-200 C-10,-280 -5,-360 0,-440" stroke="#5f9446" strokeWidth={3} fill="none" opacity={0.6} />
      {[-1, 1].flatMap(side =>
        [0.25, 0.45, 0.65].map(t => (
          <path key={`${side}${t}`} d={`M0,${-200 - 220 * t} Q${side * 50},${-210 - 220 * t} ${side * 100},${-180 - 200 * t}`} stroke="#5f9446" strokeWidth={2} fill="none" opacity={0.45} />
        )),
      )}
    </g>
  );
}

function SceneArt({ night }: { night: boolean }) {
  const bgClumps: Clump[] = useMemo(
    () => [
      { cx: 760, cy: 470, r: 120, n: 9 },
      { cx: 930, cy: 410, r: 150, n: 11 },
      { cx: 1120, cy: 390, r: 170, n: 12 },
      { cx: 1330, cy: 420, r: 160, n: 12 },
      { cx: 1520, cy: 380, r: 150, n: 10 },
    ],
    [],
  );
  const frontClumps: Clump[] = useMemo(
    () => [
      { cx: 690, cy: 590, r: 72, n: 6 },
      { cx: 850, cy: 580, r: 92, n: 8 },
      { cx: 1040, cy: 565, r: 102, n: 9 },
      { cx: 1250, cy: 575, r: 112, n: 9 },
      { cx: 1470, cy: 565, r: 122, n: 10 },
    ],
    [],
  );
  const domeY = useMemo(() => (x: number) => 330 - 420 * Math.sqrt(Math.max(0, 1 - ((x - 1180) / 640) ** 2)) + 6, []);
  const beamY = useMemo(() => () => 6, []);
  const archY = useMemo(() => (x: number) => 380 - (x - 420) * 0.55, []);

  return (
    <>
      <defs>
        {/* leaf shapes, drawn pointing down from their stem at (0,0) */}
        <path id="leaf-a" d="M0,0 C8,4 12,14 0,30 C-12,14 -8,4 0,0 Z" />
        <path id="leaf-b" d="M0,0 C6,6 7,22 0,40 C-7,22 -6,6 0,0 Z" />
        <path id="leaf-c" d="M0,0 C12,2 18,12 10,24 C6,30 2,32 0,34 C-2,32 -6,30 -10,24 C-18,12 -12,2 0,0 Z" />
        <path id="leaf-ivy" d="M0,0 C6,-2 12,2 11,9 C10,15 4,18 0,22 C-4,18 -10,15 -11,9 C-12,2 -6,-2 0,0 Z" />
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={night ? '#0c1f2b' : '#b7d6d8'} />
          <stop offset="0.6" stopColor={night ? '#173238' : '#d9e6d2'} />
          <stop offset="1" stopColor={night ? '#22392f' : '#efe8cf'} />
        </linearGradient>
        <linearGradient id="timber" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2e1f14" />
          <stop offset="0.45" stopColor={WOOD_LIGHT} />
          <stop offset="1" stopColor="#2a1c12" />
        </linearGradient>
        <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a98466" />
          <stop offset="1" stopColor="#7d5a43" />
        </linearGradient>
        <linearGradient id="reflect" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e3b24" stopOpacity="0.45" />
          <stop offset="1" stopColor="#1e3b24" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ray" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3cf" stopOpacity="0.45" />
          <stop offset="1" stopColor="#fff3cf" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="warm" cx="0.12" cy="0" r="1.1">
          <stop offset="0" stopColor="#ffe9b0" stopOpacity="0.7" />
          <stop offset="0.5" stopColor="#ffe0a0" stopOpacity="0.15" />
          <stop offset="1" stopColor="#ffe0a0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="vignette" cx="0.5" cy="0.45" r="0.78">
          <stop offset="0.55" stopColor="#0d1a10" stopOpacity="0" />
          <stop offset="1" stopColor="#0d1a10" stopOpacity="0.45" />
        </radialGradient>
        <pattern id="panes" width="44" height="54" patternUnits="userSpaceOnUse">
          <rect width="44" height="54" fill="rgba(200,225,220,0.08)" stroke="#3a2a1d" strokeWidth="2.5" />
        </pattern>
        <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b281a" />
          <stop offset="1" stopColor="#21160e" />
        </linearGradient>
        <radialGradient id="lampHalo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffcf73" stopOpacity="0.45" />
          <stop offset="0.4" stopColor="#ffcf73" stopOpacity="0.12" />
          <stop offset="1" stopColor="#ffcf73" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="lampPool" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffb85a" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffb85a" stopOpacity="0" />
        </radialGradient>
        <pattern id="bricks" width="60" height="22" patternUnits="userSpaceOnUse">
          <rect width="60" height="22" fill="none" stroke="rgba(60,36,24,0.35)" strokeWidth="1.5" />
          <line x1="30" y1="11" x2="30" y2="22" stroke="rgba(60,36,24,0.35)" strokeWidth="1.5" />
          <line x1="0" y1="11" x2="60" y2="11" stroke="rgba(60,36,24,0.35)" strokeWidth="1.5" />
        </pattern>
        <filter id="soft">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <filter id="glow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="dome">
          <ellipse cx="1180" cy="330" rx="640" ry="420" />
        </clipPath>
      </defs>

      {/* outside the glass */}
      <rect width={SCENE_W} height={SCENE_H} fill="url(#sky)" />
      <g className="clouds" filter="url(#soft)" opacity={night ? 0.1 : 0.6}>
        <ellipse cx="300" cy="120" rx="140" ry="34" fill="#fff" />
        <ellipse cx="980" cy="90" rx="170" ry="36" fill="#fff" />
        <ellipse cx="1420" cy="150" rx="150" ry="32" fill="#fff" />
      </g>
      {night && (
        <g fill="#fff6d8">
          {[...Array(40)].map((_, i) => (
            <circle key={i} cx={(i * 397) % 1600} cy={(i * 131) % 330} r={(i % 3) * 0.6 + 0.6} opacity={0.7} />
          ))}
        </g>
      )}
      <g filter="url(#soft)" opacity={0.75}>
        <ellipse cx="200" cy="560" rx="260" ry="130" fill={night ? '#16302a' : '#5d8a5c'} />
        <ellipse cx="560" cy="520" rx="200" ry="120" fill={night ? '#142c28' : '#6b9566'} />
      </g>

      {/* glass dome: timber glazing bars with iron ribs */}
      <g clipPath="url(#dome)">
        <rect x="540" y="-100" width="1300" height="900" fill="url(#panes)" />
        {Array.from({ length: 15 }, (_, i) => {
          const a = Math.PI * (0.02 + (i / 14) * 0.96);
          return <line key={i} x1="1180" y1="-90" x2={1180 - Math.cos(a) * 900} y2={-90 + Math.sin(a) * 900} stroke={WOOD} strokeWidth="4" />;
        })}
        {[0.95, 0.8, 0.64, 0.47].map((k, i) => (
          <ellipse key={i} cx="1180" cy="330" rx={640 * k} ry={420 * k} fill="none" stroke={WOOD} strokeWidth="4" />
        ))}
      </g>

      {/* the tall glass wall on the left, dark timber mullions */}
      <rect x="0" y="0" width="560" height={FLOOR_Y} fill="url(#panes)" />
      {[0, 132, 264, 396, 528].map(x => (
        <rect key={x} x={x} y="0" width="9" height={FLOOR_Y} fill={WOOD} />
      ))}
      {[140, 300, 460].map(y => (
        <rect key={y} x="0" y={y} width="560" height="7" fill={WOOD} />
      ))}

      {!night && (
        <g className="rays" style={{ mixBlendMode: 'screen' }}>
          <polygon points="40,0 180,0 980,900 700,900" fill="url(#ray)" />
          <polygon points="260,0 330,0 1180,900 1030,900" fill="url(#ray)" opacity="0.6" />
        </g>
      )}

      {/* canopy, palms, front shrubs */}
      <Foliage clumps={bgClumps} seed={11} shade={night ? 0.6 : 0.15} />
      <Palm x={980} y={600} h={300} lean={-30} scale={1.1} />
      <Palm x={1290} y={610} h={340} lean={25} scale={1.2} />
      <Palm x={1500} y={600} h={260} lean={-20} />
      <Foliage clumps={frontClumps} seed={23} shade={night ? 0.5 : 0} />
      <Flowers seed={5} x0={640} x1={1580} y0={600} y1={638} n={45} />

      {/* structure */}
      <Arch d="M180,330 C200,140 360,30 640,-30" night={night} />
      <Arch d="M420,380 C450,190 640,80 900,40 C1060,18 1200,30 1330,-20" night={night} />
      <path d="M540,330 A640,420 0 0 1 1820,330" fill="none" stroke="#1d2f2c" strokeWidth="18" />
      <path d="M540,330 A640,420 0 0 1 1820,330" fill="none" stroke={night ? '#161b1a' : IRON} strokeWidth="13" />
      <Pillar x={180} top={330} />
      <Pillar x={420} top={380} />

      {/* ivy hanging from the beams, the arches and the dome rim */}
      <Ivy x0={10} x1={550} y={beamY} seed={31} count={18} maxLen={230} />
      <Ivy x0={440} x1={900} y={archY} seed={37} count={9} maxLen={160} />
      <Ivy x0={600} x1={1600} y={domeY} seed={43} count={22} maxLen={200} />
      <Ivy x0={150} x1={200} y={() => 340} seed={47} count={4} maxLen={260} />

      {/* dark wooden floor (night) / brick (day) with soft reflections */}
      {night ? <WoodFloor /> : (
        <>
          <rect x="0" y={FLOOR_Y} width={SCENE_W} height={SCENE_H - FLOOR_Y} fill="url(#floor)" />
          <rect x="0" y={FLOOR_Y} width={SCENE_W} height={SCENE_H - FLOOR_Y} fill="url(#bricks)" />
        </>
      )}
      <rect x="560" y={FLOOR_Y} width="1040" height="150" fill="url(#reflect)" />

      {!night && <rect width={SCENE_W} height={SCENE_H} fill="url(#warm)" style={{ mixBlendMode: 'soft-light' }} />}
      <rect width={SCENE_W} height={SCENE_H} fill="url(#vignette)" />
      {night && <rect width={SCENE_W} height={SCENE_H} fill="#07141c" opacity="0.5" style={{ mixBlendMode: 'multiply' }} />}
      {night && (
        <>
          <circle cx="1105" cy="150" r="16" fill="#f4f1e0" opacity="0.85" />
          <circle cx="1105" cy="150" r="42" fill="#f4f1e0" opacity="0.08" />
          <Pendant x={690} y={330} len={330} />
          <Pendant x={1240} y={270} len={270} />
          {/* warm pools of light on the floor under the lamps */}
          <ellipse cx="690" cy="820" rx="220" ry="46" fill="url(#lampPool)" style={{ mixBlendMode: 'screen' }} />
          <ellipse cx="1240" cy="800" rx="200" ry="40" fill="url(#lampPool)" style={{ mixBlendMode: 'screen' }} />
        </>
      )}
      <Motes night={night} />
    </>
  );
}

const MemoArt = memo(SceneArt);

/** Photo coordinates (1536×864 render) → scene units (1600×900). */
export const fromPhoto = (x: number, y: number) => ({ x: (x * SCENE_W) / 1536, y: (y * SCENE_H) / 864 });

/** Living light over the photographic scene: lamp halos that breathe and drifting dust motes. */
function PhotoFx() {
  const lamps = [fromPhoto(525, 296), fromPhoto(1020, 192), fromPhoto(478, 483)];
  return (
    <g pointerEvents="none">
      <defs>
        <radialGradient id="photoHalo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd27a" stopOpacity="0.38" />
          <stop offset="0.35" stopColor="#ffc35e" stopOpacity="0.1" />
          <stop offset="1" stopColor="#ffc35e" stopOpacity="0" />
        </radialGradient>
      </defs>
      {lamps.map((p, i) => (
        <circle key={i} className={`lamp-breathe lb-${i}`} cx={p.x} cy={p.y} r={i === 2 ? 70 : 120} fill="url(#photoHalo)" style={{ mixBlendMode: 'screen' }} />
      ))}
      <Motes night />
    </g>
  );
}

export function GardenScene({ night, dim, photo, children }: { night: boolean; dim: number; photo?: string; children?: ReactNode }) {
  return (
    <div className="scene" aria-hidden={!children}>
      <svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} preserveAspectRatio="xMidYMid slice" className={`scene-svg ${photo ? 'photo' : ''}`}>
        {photo ? (
          <>
            <image href={photo} x={0} y={0} width={SCENE_W} height={SCENE_H} preserveAspectRatio="xMidYMid slice" />
            <PhotoFx />
          </>
        ) : (
          <MemoArt night={night} />
        )}
        {children}
        {!photo && (
          <g pointerEvents="none">
            <BigLeaf x={-10} y={930} rot={-14} s={0.8} cls="sway" />
            <BigLeaf x={-60} y={880} rot={-42} s={0.7} cls="sway sway-2" c="#2b5230" />
            <BigLeaf x={1620} y={930} rot={18} s={0.8} cls="sway sway-3" c="#1f3d25" />
          </g>
        )}
      </svg>
      <div className="scene-dim" style={{ opacity: dim }} />
    </div>
  );
}
