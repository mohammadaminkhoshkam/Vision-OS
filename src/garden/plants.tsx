// Garden Studio catalog (PP-03): hand-drawn plants and objects, drawn around (0,0) = base.

export type DecorKind = 'fern' | 'tulips' | 'sunflower' | 'lavender' | 'rose' | 'cactus' | 'monstera' | 'snake' | 'ivy' | 'lantern' | 'bench' | 'desk';

export interface CatalogItem {
  kind: DecorKind;
  label: string;
  group: 'plant' | 'object';
  colors?: string[];
  /** dew points to unlock (only when reward mode is on); 0 = free */
  cost: number;
  care: string;
}

export const CATALOG: CatalogItem[] = [
  { kind: 'fern', label: 'Fern', group: 'plant', cost: 0, care: 'Likes shade, high humidity' },
  { kind: 'monstera', label: 'Monstera', group: 'plant', cost: 0, care: 'Indirect light, water weekly' },
  { kind: 'snake', label: 'Snake plant', group: 'plant', cost: 0, care: 'Little water, hardy' },
  { kind: 'ivy', label: 'Ivy', group: 'plant', cost: 3, care: 'Soft light, moist soil' },
  { kind: 'tulips', label: 'Tulips', group: 'plant', colors: ['#9e2b33', '#d9a441', '#c86a3a', '#efe6d2'], cost: 3, care: 'Full light, spring bloomer' },
  { kind: 'lavender', label: 'Lavender', group: 'plant', colors: ['#9c86d6', '#7a68b8'], cost: 4, care: 'Sun, well-drained soil' },
  { kind: 'rose', label: 'Rose', group: 'plant', colors: ['#9e2b33', '#d9465f', '#efe6d2', '#d9a441'], cost: 6, care: 'Sun, regular watering' },
  { kind: 'sunflower', label: 'Sunflower', group: 'plant', cost: 5, care: 'Full sun' },
  { kind: 'cactus', label: 'Cactus', group: 'plant', colors: ['#c86a3a', '#d9a441'], cost: 2, care: 'Very little water' },
  { kind: 'lantern', label: 'Lantern', group: 'object', cost: 4, care: '—' },
  { kind: 'bench', label: 'Bench', group: 'object', cost: 8, care: '—' },
  { kind: 'desk', label: 'Study desk', group: 'object', cost: 10, care: '—' },
];

export const catalogItem = (k: DecorKind) => CATALOG.find(c => c.kind === k)!;
export const DECOR_KINDS = CATALOG.map(c => ({ kind: c.kind, label: c.label }));

function Pot({ w = 46, h = 36, color = '#a85a38' }: { w?: number; h?: number; color?: string }) {
  return (
    <g>
      <path d={`M${-w / 2},${-h} L${w / 2},${-h} L${w / 2 - 7},0 L${-w / 2 + 7},0 Z`} fill={color} />
      <rect x={-w / 2 - 4} y={-h - 8} width={w + 8} height={10} rx={3} fill="#874326" />
      <path d={`M${-w / 2 + 6},${-h + 8} L${-w / 2 + 11},-4`} stroke="#d08a62" strokeWidth={3} strokeLinecap="round" opacity={0.6} />
    </g>
  );
}

export function Decor({ kind, color }: { kind: DecorKind; color?: string }) {
  switch (kind) {
    case 'tulips':
      return (
        <g>
          {[-14, 0, 14].map((x, i) => (
            <g key={i}>
              <path d={`M${x},-40 Q${x + 4},-70 ${x},-${92 - i * 8}`} stroke="#3a6b35" strokeWidth={3} fill="none" />
              <path d={`M${x - 9},-${92 - i * 8} q9,-22 18,0 q-3,12 -9,12 q-6,0 -9,-12z`} fill={color ?? ['#9e2b33', '#d9a441', '#c86a3a'][i]} />
            </g>
          ))}
          <path d="M-6,-44 q-18,-14 -20,-34 q14,8 20,30z" fill="#2f5a33" />
          <Pot />
        </g>
      );
    case 'sunflower':
      return (
        <g>
          <path d="M0,-40 Q6,-90 0,-130" stroke="#3a6b35" strokeWidth={5} fill="none" />
          <path d="M2,-80 q22,-12 30,-2 q-14,10 -30,2z" fill="#2f5a33" />
          {Array.from({ length: 12 }, (_, i) => (
            <ellipse key={i} cx={0} cy={-148} rx={6} ry={15} fill="#d9a441" transform={`rotate(${i * 30} 0 -130)`} />
          ))}
          <circle cx={0} cy={-130} r={11} fill="#5a3418" />
          <Pot />
        </g>
      );
    case 'lavender':
      return (
        <g>
          {[-16, -8, 0, 8, 16].map((x, i) => (
            <g key={i}>
              <path d={`M${x / 2},-40 L${x},-${88 + (i % 2) * 10}`} stroke="#5a7a4a" strokeWidth={2} />
              {Array.from({ length: 6 }, (_, j) => (
                <ellipse key={j} cx={x + (j % 2 ? 2 : -2)} cy={-(88 + (i % 2) * 10) + j * 6} rx={3} ry={4} fill={color ?? '#9c86d6'} opacity={j % 2 ? 1 : 0.8} />
              ))}
            </g>
          ))}
          <Pot color="#b9a582" />
        </g>
      );
    case 'rose':
      return (
        <g>
          <circle cx={0} cy={-72} r={34} fill="#24472a" />
          <circle cx={-14} cy={-82} r={14} fill="#3a6b35" />
          {[
            [-12, -86],
            [10, -78],
            [-2, -60],
            [16, -94],
          ].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={8} fill={color ?? '#9e2b33'} />
              <circle cx={x - 1} cy={y - 1} r={4} fill="#fff" opacity={0.18} />
            </g>
          ))}
          <Pot w={58} h={40} />
        </g>
      );
    case 'fern':
      return (
        <g>
          {[-60, -35, -12, 12, 35, 60].map((a, i) => (
            <g key={i} transform={`rotate(${a} 0 -40)`}>
              <path d="M0,-40 Q4,-80 0,-110" stroke="#24472a" strokeWidth={3} fill="none" />
              {Array.from({ length: 8 }, (_, j) => (
                <path key={j} d={`M0,${-50 - j * 7} l${10 - j},-6 M0,${-50 - j * 7} l${-10 + j},-6`} stroke={j % 2 ? '#3a6b35' : '#4c8240'} strokeWidth={3} strokeLinecap="round" />
              ))}
            </g>
          ))}
          <Pot color="#6b7a55" />
        </g>
      );
    case 'cactus':
      return (
        <g>
          <rect x={-10} y={-100} width={20} height={64} rx={10} fill="#3a6b35" />
          <path d="M-10,-70 h-10 a6,6 0 0 1 -6,-6 v-14" stroke="#3a6b35" strokeWidth={10} strokeLinecap="round" fill="none" />
          <path d="M10,-60 h10 a6,6 0 0 0 6,-6 v-10" stroke="#3a6b35" strokeWidth={10} strokeLinecap="round" fill="none" />
          <circle cx={0} cy={-104} r={6} fill={color ?? '#c86a3a'} />
          <Pot w={40} h={30} color="#b8754a" />
        </g>
      );
    case 'monstera':
      return (
        <g>
          {[
            [-34, -110, -30, 1],
            [30, -120, 25, 1.1],
            [0, -140, 0, 1.2],
            [-50, -70, -55, 0.8],
            [48, -76, 50, 0.85],
          ].map(([x, y, r, s], i) => (
            <g key={i} transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
              <path d="M0,30 Q2,10 0,0" stroke="#1d3a20" strokeWidth={3} fill="none" />
              <path d="M0,0 C-30,-6 -36,-40 -10,-56 C-4,-60 4,-60 10,-56 C36,-40 30,-6 0,0 Z" fill={i % 2 ? '#2b5230' : '#2f5a33'} />
              <path d="M0,-2 V-54 M0,-20 L-18,-30 M0,-34 L16,-44 M0,-14 L16,-22" stroke="#15291a" strokeWidth={2.5} />
            </g>
          ))}
          <Pot w={56} h={40} color="#4a3a2a" />
        </g>
      );
    case 'snake':
      return (
        <g>
          {[-16, -6, 4, 14].map((x, i) => (
            <path key={i} d={`M${x},-36 Q${x + (i % 2 ? 6 : -6)},-${90 + i * 8} ${x + (i % 2 ? 2 : -2)},-${120 + (i % 3) * 14} Q${x + 6},-80 ${x + 8},-36 Z`} fill={i % 2 ? '#3f7038' : '#2b5230'} stroke="#c9b65a" strokeWidth={1.5} />
          ))}
          <Pot w={44} h={34} color="#ded6c4" />
        </g>
      );
    case 'ivy':
      return (
        <g>
          {[-24, -10, 6, 20].map((x, i) => (
            <g key={i}>
              <path d={`M${x / 2},-44 Q${x},-20 ${x + (i % 2 ? 6 : -6)},${10 + i * 10}`} stroke="#2a3d22" strokeWidth={1.5} fill="none" />
              {Array.from({ length: 5 }, (_, j) => (
                <path key={j} transform={`translate(${x + (j % 2 ? 4 : -4)} ${-40 + j * 12 + i * 2}) scale(0.7)`} d="M0,0 C6,-2 12,2 11,9 C10,15 4,18 0,22 C-4,18 -10,15 -11,9 C-12,2 -6,-2 0,0 Z" fill={j % 2 ? '#3a6b35' : '#2f5a33'} />
              ))}
            </g>
          ))}
          <circle cx={0} cy={-58} r={20} fill="#2b5230" />
          <Pot w={42} h={30} color="#8a5a3a" />
        </g>
      );
    case 'lantern':
      return (
        <g>
          <rect x={-3} y={-170} width={6} height={170} fill="#2a1f12" />
          <path d="M-18,-170 h36 l-6,-12 h-24z" fill="#1e170e" />
          <rect x={-14} y={-168} width={28} height={36} rx={4} fill="#ffd98a" stroke="#1e170e" strokeWidth={3} />
          <circle cx={0} cy={-150} r={30} fill="#ffd98a" opacity={0.16} />
          <rect x={-14} y={-4} width={28} height={6} rx={2} fill="#1e170e" />
        </g>
      );
    case 'bench':
      return (
        <g>
          <rect x={-60} y={-40} width={120} height={8} rx={3} fill="#5a3d26" />
          <rect x={-60} y={-60} width={120} height={7} rx={3} fill="#6b4a30" />
          <rect x={-60} y={-74} width={120} height={7} rx={3} fill="#6b4a30" />
          <path d="M-52,-32 v32 M52,-32 v32 M-52,-74 v42 M52,-74 v42" stroke="#1e1a14" strokeWidth={5} />
        </g>
      );
    case 'desk':
      return (
        <g>
          <rect x={-70} y={-58} width={140} height={10} rx={2} fill="#4a3020" />
          <path d="M-62,-48 v48 M62,-48 v48" stroke="#2e1f14" strokeWidth={7} />
          <rect x={-40} y={-74} width={44} height={16} rx={1} fill="#efe6cf" transform="rotate(-6 -18 -66)" />
          <path d="M-36,-70 h34 M-36,-66 h28" stroke="#8a7a5a" strokeWidth={1.2} transform="rotate(-6 -18 -66)" />
          <rect x={18} y={-92} width={8} height={34} fill="#b08a3e" />
          <circle cx={22} cy={-96} r={10} fill="#ffd98a" opacity={0.85} />
          <rect x={34} y={-70} width={22} height={12} rx={2} fill="#2c5450" />
        </g>
      );
  }
}
