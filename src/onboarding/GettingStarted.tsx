// Home card for the first days: the core research flow as a checklist that ticks itself.
import { useState } from 'react';
import { board } from '../board/store';
import { loadJson, saveJson } from '../lib/store';
import { focus } from '../focus/store';
import { layout } from '../state/layout';
import { workspace } from '../state/workspace';
import { go } from '../state/app';
import { Icon } from '../ui/icons';
import { openTutorial, tutorial } from '../vision/GestureTutorial';
import { checklist, progress } from './checklist';

const KEY = 'vos.onboarding';

export function GettingStarted() {
  const cards = board.use(s => s.doc.nodes.length);
  const [saved, setSaved] = useState(() => {
    const v = loadJson<{ start: number | null; dismissed: boolean }>(KEY, { start: null, dismissed: false });
    if (v.start === null) saveJson(KEY, (v.start = board.get().doc.nodes.length, v));
    return v;
  });
  const opened = workspace.use(s => s.recent.some(a => a.kind !== 'video'));
  const sessions = focus.use(s => s.sessions.filter(x => x.status === 'completed').length);
  const spaces = layout.use(s => s.workspaces.length);
  const tutorialDone = tutorial.use(s => s.done);
  const items = checklist({ openedPaper: opened, boardCards: cards, boardCardsAtStart: saved.start ?? cards, focusSessions: sessions, spaces, tutorialDone });
  const p = progress(items);
  if (saved.dismissed || p >= 1) return null;
  const act: Record<string, () => void> = { read: () => go('library'), clip: () => go('board'), focus: () => go('focus'), space: () => go('reader'), hands: openTutorial };
  return (
    <section className="card hcard getting-started">
      <header className="card-h">
        <Icon name="sparkle" />
        <h3>Your first research session</h3>
        <button
          className="ibtn tiny"
          onClick={() => {
            const v = { ...saved, dismissed: true };
            saveJson(KEY, v);
            setSaved(v);
          }}
          aria-label="Hide"
          title="Hide"
        >
          <Icon name="close" size={14} />
        </button>
      </header>
      <div className="gs-bar" aria-label={`${Math.round(p * 100)}% done`}>
        <span style={{ width: `${Math.round(p * 100)}%` }} />
      </div>
      <ul className="gs-list">
        {items.map(i => (
          <li key={i.id} className={i.done ? 'done' : ''}>
            <button onClick={act[i.id]} disabled={i.done}>
              <span className="gs-check">{i.done && <Icon name="check" size={13} stroke={3} />}</span>
              <span className="gs-text">
                <b>{i.label}</b>
                {!i.done && <small>{i.hint}</small>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
