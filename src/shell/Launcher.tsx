// Unified launcher (Ctrl+K), Raycast/Arc-style: one search across papers, videos, board cards,
// screens and commands. Typing a spoken-style command (e.g. “next page”) runs it directly.
import { useEffect, useMemo, useRef, useState } from 'react';
import { appData } from '../apps/data';
import { board } from '../board/store';
import { loadList } from '../lib/store';
import { app, go, openPaper, openVideo } from '../state/app';
import { APPS } from '../apps/registry';
import { layout } from '../state/layout';
import { restoreSpace } from '../state/resume';
import { Icon, type IconName } from '../ui/icons';
import { normalize, parseCommand } from '../voice/commands';
import { run } from '../voice/run';

interface Result {
  id: string;
  icon: IconName;
  title: string;
  sub: string;
  group: string;
  go: () => void;
}

// tools come from the app registry (one place declares every app)
const SCREENS = APPS.map(a => ({ id: a.id, s: a.screen, tab: a.tab, t: a.label, icon: a.icon, k: a.keywords }));

function score(hay: string, q: string) {
  const h = normalize(hay);
  const words = q.split(' ').filter(Boolean);
  if (!words.length) return 0;
  let s = 0;
  for (const w of words) {
    const i = h.indexOf(w);
    if (i < 0) return 0;
    s += i === 0 ? 3 : 1;
  }
  return s;
}

export function Launcher() {
  const open = app.use(s => s.commandOpen);
  const [text, setText] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) {
      setText('');
      setSel(0);
      setTimeout(() => input.current?.focus(), 20);
    }
  }, [open]);
  const close = () => app.set({ commandOpen: false });

  const results = useMemo<Result[]>(() => {
    if (!open) return [];
    const q = normalize(text);
    const out: (Result & { s: number })[] = [];
    const cmd = q ? parseCommand(text) : null;
    if (cmd) out.push({ id: 'cmd', icon: 'mic', title: `Run command: “${text}”`, sub: 'Command', group: 'Command', s: 100, go: () => run(cmd) });
    for (const sc of SCREENS) {
      const s = q ? score(`${sc.t} ${sc.k}`, q) : 1;
      if (s) out.push({ id: `s-${sc.id}`, icon: sc.icon, title: sc.t, sub: 'Tool', group: 'Tools', s: s + 1, go: () => (sc.tab && app.set({ plannerTab: sc.tab }), go(sc.s)) });
    }
    for (const w of layout.get().workspaces) {
      const s = q ? score(`${w.name} space workspace`, q) : 0.8;
      if (s) out.push({ id: `w-${w.id}`, icon: 'apps', title: w.name, sub: `Research space · ${w.main}${w.side ? ` + ${w.side}` : ''}`, group: 'Spaces', s: s + 0.8, go: () => void restoreSpace(w) });
    }
    for (const p of appData.get().papers) {
      const s = q ? score(`${p.title} ${p.authors} ${p.venue} ${p.year}`, q) : 0.5;
      if (s) out.push({ id: `p-${p.id}`, icon: 'book', title: p.title, sub: `${p.authors?.split(',')[0] ?? ''} · ${p.year} · p. ${p.lastPage || 1}`, group: 'Papers', s: s + 0.5, go: () => openPaper(p) });
    }
    for (const v of loadList<{ id: string; title: string }>('vos.yt.recent')) {
      const s = q ? score(v.title, q) : 0.3;
      if (s) out.push({ id: `v-${v.id}`, icon: 'youtube', title: v.title, sub: 'Recent video', group: 'Videos', s, go: () => openVideo(v.id) });
    }
    if (q)
      for (const n of board.get().doc.nodes) {
        const s = score(n.text, q);
        if (s) out.push({ id: `n-${n.id}`, icon: 'board', title: n.text.slice(0, 80), sub: n.source && 'title' in n.source ? n.source.title.slice(0, 40) : 'Note', group: 'Knowledge board', s, go: () => (board.set({ selected: n.id }), go('board')) });
      }
    return out.sort((a, b) => b.s - a.s).slice(0, 12);
  }, [text, open]);

  if (!open) return null;
  const choose = (r?: Result) => {
    if (!r) return;
    close();
    r.go();
  };
  return (
    <div className="cmd-scrim" onClick={close}>
      <div className="cmd card launcher" onClick={e => e.stopPropagation()}>
        <div className="cmd-input">
          <Icon name="search" />
          <input
            ref={input}
            value={text}
            onChange={e => {
              setText(e.target.value);
              setSel(0);
            }}
            onKeyDown={e => {
              if (e.key === 'Escape') close();
              else if (e.key === 'ArrowDown') (e.preventDefault(), setSel(i => Math.min(results.length - 1, i + 1)));
              else if (e.key === 'ArrowUp') (e.preventDefault(), setSel(i => Math.max(0, i - 1)));
              else if (e.key === 'Enter') choose(results[sel]);
            }}
            placeholder="Search papers, videos, the board and screens, or type a command like “next page”"
          />
          <kbd>Esc</kbd>
        </div>
        <ul className="results">
          {results.map((r, i) => (
            <li key={r.id}>
              {(i === 0 || results[i - 1].group !== r.group) && <div className="res-group">{r.group}</div>}
              <button className={`res ${i === sel ? 'on' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => choose(r)}>
                <Icon name={r.icon} size={18} />
                <span className="res-title" dir="auto">
                  {r.title}
                </span>
                <span className="res-sub" dir="auto">
                  {r.sub}
                </span>
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="muted small res-empty">Nothing found</li>}
        </ul>
      </div>
    </div>
  );
}
