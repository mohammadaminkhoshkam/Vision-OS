// Task strip in the title bar (after daedalOS's taskbar): one tab per open tool with a live
// preview on hover, buttons to put a tool beside the current one or close it, and the «Spaces»
// menu that saves and restores whole research spaces.
import { useEffect, useRef, useState } from 'react';
import { board } from '../board/store';
import { app, go } from '../state/app';
import { closePane, effectiveSide, isPane, layout, setSide, slotOf, type PaneId } from '../state/layout';
import { deleteSpace, restoreSpace, saveSpace } from '../state/resume';
import { describeActivity, relativeTime, workspace } from '../state/workspace';
import { Icon } from '../ui/icons';
import { PANE_META, usePaneTitle } from './Workspace';
import { setEnterOrigin } from './BranchDock';

function Preview({ id }: { id: PaneId }) {
  const recent = workspace.use(s => s.recent);
  const nodes = board.use(s => s.doc.nodes);
  const title = usePaneTitle(id);
  const act = recent.find(a => (id === 'cinema' ? a.kind === 'video' : a.kind !== 'video'));
  return (
    <div className="tab-preview" role="tooltip">
      <div className="tp-head">
        <Icon name={PANE_META[id].icon} size={16} /> {PANE_META[id].label}
      </div>
      <div className="tp-title" dir="auto">
        {title}
      </div>
      {id !== 'board' && act && (
        <div className="tp-meta">
          {describeActivity(act)} · {relativeTime(act.at, Date.now())}
        </div>
      )}
      {id === 'board' && (
        <ul className="tp-cards">
          {nodes.slice(-3).reverse().map(n => (
            <li key={n.id} dir="auto">
              {n.type === 'figure' ? '▣ Figure' : n.text.slice(0, 60) || '—'}
            </li>
          ))}
          {!nodes.length && <li className="muted">Empty board</li>}
        </ul>
      )}
    </div>
  );
}

function Tab({ id }: { id: PaneId }) {
  const screen = app.use(s => s.screen);
  const { side, playing, pipDismissed } = layout.use(s => s);
  const title = usePaneTitle(id);
  const [hover, setHover] = useState(false);
  const slot = slotOf(id, { screen, side, playing, pipDismissed });
  const canBeside = isPane(screen) && screen !== id;
  return (
    <div className={`ws-tab slot-${slot}`} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        className="ws-tab-main"
        onClick={e => {
          setEnterOrigin(e.currentTarget);
          go(id);
        }}
        aria-current={slot === 'main' ? 'page' : undefined}
        title={title}
      >
        <Icon name={PANE_META[id].icon} size={15} />
        <span dir="auto">{title}</span>
        {slot === 'side' && <small>beside</small>}
        {slot === 'pip' && <small>floating</small>}
      </button>
      {canBeside && (
        <button className="ws-tab-x" onClick={() => setSide(effectiveSide(screen, side) === id ? null : id)} title={slot === 'side' ? 'Stop showing beside' : 'Show beside the current tool'} aria-label="Show beside">
          <Icon name="split" size={13} />
        </button>
      )}
      <button
        className="ws-tab-x"
        onClick={() => {
          if (app.get().screen === id) go('home');
          closePane(id);
        }}
        title="Close"
        aria-label={`Close ${PANE_META[id].label}`}
      >
        <Icon name="close" size={13} />
      </button>
      {hover && <Preview id={id} />}
    </div>
  );
}

function Spaces() {
  const spaces = layout.use(s => s.workspaces);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const on = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    setTimeout(() => addEventListener('mousedown', on), 0);
    return () => removeEventListener('mousedown', on);
  }, [open]);
  return (
    <div className="ws-spaces" ref={ref}>
      <button className={`ws-tab-main spaces-btn ${open ? 'on' : ''}`} onClick={() => setOpen(v => !v)} title="Research spaces: save and restore a whole layout">
        <Icon name="apps" size={15} />
        <span>Spaces</span>
      </button>
      {open && (
        <div className="tb-pop spaces-pop">
          <header>
            <b>Research spaces</b>
          </header>
          <p className="muted small">A space remembers the layout, the paper and video with their positions, the scene and the sound mix.</p>
          <form
            className="tb-name"
            onSubmit={e => {
              e.preventDefault();
              saveSpace(name);
              setName('');
            }}
          >
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Name this space…" aria-label="Space name" />
            <button className="btn small primary" type="submit">
              Save
            </button>
          </form>
          <ul className="spaces-list">
            {spaces.length === 0 && <li className="muted small">No saved spaces yet.</li>}
            {spaces.map(w => (
              <li key={w.id}>
                <button
                  className="space-row"
                  onClick={() => {
                    setOpen(false);
                    void restoreSpace(w);
                  }}
                >
                  <Icon name={PANE_META[w.main].icon} size={16} />
                  <span className="sr-text">
                    <b dir="auto">{w.name}</b>
                    <small>
                      {PANE_META[w.main].label}
                      {w.side ? ` + ${PANE_META[w.side].label}` : ''}
                      {w.ambient ? ' · sound' : ''} · {relativeTime(w.created, Date.now())}
                    </small>
                  </span>
                </button>
                <button className="ibtn" onClick={() => deleteSpace(w.id)} title="Delete" aria-label={`Delete ${w.name}`}>
                  <Icon name="trash" size={15} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function WorkspaceTabs() {
  const opened = layout.use(s => s.opened);
  return (
    <nav className="ws-tabs" aria-label="Open tools">
      {(['reader', 'board', 'cinema'] as PaneId[]).filter(p => opened.includes(p)).map(p => (
        <Tab key={p} id={p} />
      ))}
      <Spaces />
    </nav>
  );
}
