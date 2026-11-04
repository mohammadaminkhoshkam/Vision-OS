// Persistent workspace: reader, knowledge board and video are panes that stay mounted once opened.
// The screen you navigate to is the main pane; one more can sit beside it behind a draggable
// splitter (mouse, keyboard or a pinch-drag), and a playing video floats in a small window when
// you leave it. Panes never move in the DOM — only their slot changes — so an open PDF keeps its
// scroll position and a YouTube iframe never reloads.
import { useEffect, useRef, type ReactNode } from 'react';
import { Board } from '../board/Board';
import { board } from '../board/store';
import { Cinema } from '../cinema/Cinema';
import { Reader } from '../reader/Reader';
import { app, go } from '../state/app';
import { activePane, closePane, commitRatio, effectiveSide, isPane, layout, openPane, PANES, setRatio, setSide, slotOf, type PaneId, type Slot } from '../state/layout';
import { PaneContext } from '../state/pane';
import { workspace } from '../state/workspace';
import { Icon, type IconName } from '../ui/icons';
import { useVisionHandler } from '../vision/router';

export const PANE_META: Record<PaneId, { label: string; icon: IconName }> = {
  reader: { label: 'Reader', icon: 'book' },
  board: { label: 'Knowledge board', icon: 'network' },
  cinema: { label: 'Video', icon: 'monitor' },
};

/** What a pane currently holds, for tabs and headers. */
export function usePaneTitle(p: PaneId) {
  const doc = app.use(s => s.doc);
  const live = workspace.use(s => s.live);
  const cards = board.use(s => s.doc.nodes.length);
  if (p === 'reader') return doc ? (doc.source === 'marginal' ? doc.paper.title : doc.name) : 'Reader';
  if (p === 'cinema') return live.cinema ?? 'Video';
  return cards ? `Board · ${cards} card${cards === 1 ? '' : 's'}` : 'Knowledge board';
}

function SideHeader({ id, main }: { id: PaneId; main: PaneId }) {
  const title = usePaneTitle(id);
  return (
    <header className="pane-head">
      <Icon name={PANE_META[id].icon} size={16} />
      <span className="pane-title" dir="auto">
        {title}
      </span>
      <button
        className="ibtn"
        onClick={() => {
          setSide(main);
          go(id);
        }}
        title="Swap sides"
        aria-label="Swap sides"
      >
        <Icon name="split" size={18} />
      </button>
      <button className="ibtn" onClick={() => setSide(null)} title="Close the side pane (keeps it open in the background)" aria-label="Close the side pane">
        <Icon name="close" size={18} />
      </button>
    </header>
  );
}

function Pane({ id, slot, active, main, ratio, hasSide, children }: { id: PaneId; slot: Slot; active: boolean; main: PaneId | null; ratio: number; hasSide: boolean; children: ReactNode }) {
  const visible = slot === 'main' || slot === 'side';
  const pct = `${(ratio * 100).toFixed(2)}%`;
  const geom =
    slot === 'side' ? { left: `calc(${pct} + 7px)`, right: 0 } : slot === 'pip' ? undefined : hasSide && slot === 'main' ? { left: 0, width: `calc(${pct} - 7px)` } : { left: 0, right: 0 };
  const touch = () => layout.get().focused !== id && layout.set({ focused: id });
  return (
    <section
      className={`pane pane-${id} slot-${slot} ${active && hasSide ? 'is-active' : ''}`}
      style={geom}
      inert={slot === 'hidden'}
      aria-hidden={slot === 'hidden' || undefined}
      aria-label={PANE_META[id].label}
      onPointerDownCapture={touch}
      onClickCapture={touch}
    >
      {slot === 'side' && main && <SideHeader id={id} main={main} />}
      <div className="pane-body">
        <PaneContext.Provider value={{ id, slot, visible, active }}>{children}</PaneContext.Provider>
      </div>
    </section>
  );
}

function Splitter({ ratio, host }: { ratio: number; host: React.RefObject<HTMLDivElement | null> }) {
  const dragging = useRef(false);
  const at = (clientX: number) => {
    const r = host.current?.getBoundingClientRect();
    if (r) setRatio((clientX - r.left) / r.width);
  };
  // pinch-drag the handle with the hand cursor
  useVisionHandler((e, px) => {
    if (e.type === 'DRAG_START' && px && document.elementFromPoint(px.x, px.y)?.closest('.pane-splitter')) return (dragging.current = true);
    if (e.type === 'DRAG_MOVE' && dragging.current && px) return at(px.x), true;
    if (e.type === 'DRAG_END' && dragging.current) return (dragging.current = false), commitRatio(), true;
    return false;
  }, []);
  return (
    <div
      className="pane-splitter"
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuemin={30}
      aria-valuemax={75}
      aria-label="Resize panes"
      tabIndex={0}
      data-vt
      style={{ left: `calc(${(ratio * 100).toFixed(2)}% - 7px)` }}
      onPointerDown={e => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        document.documentElement.dataset.resizing = '1';
      }}
      onPointerMove={e => dragging.current && at(e.clientX)}
      onPointerUp={() => {
        dragging.current = false;
        delete document.documentElement.dataset.resizing;
        commitRatio();
      }}
      onDoubleClick={() => (setRatio(0.58), commitRatio())}
      onKeyDown={e => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          setRatio(ratio + (e.key === 'ArrowLeft' ? -0.03 : 0.03));
          commitRatio();
        }
      }}
    >
      <span />
    </div>
  );
}

export function Workspace() {
  const screen = app.use(s => s.screen);
  const hasDoc = app.use(s => !!s.doc);
  const { side, ratio, opened, focused, playing, pipDismissed } = layout.use(s => s);
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPane(screen)) openPane(screen);
    if (screen === 'cinema' && layout.get().pipDismissed) layout.set({ pipDismissed: false });
  }, [screen]);
  useEffect(() => {
    if (hasDoc) openPane('reader');
  }, [hasDoc]);
  useEffect(() => {
    if (side) openPane(side);
  }, [side]);

  const input = { screen, side, playing, pipDismissed };
  const active = activePane(input, focused);
  const sidePane = effectiveSide(screen, side);
  const main = isPane(screen) ? screen : null;

  return (
    <div ref={host} className={`workspace-layer ${main ? 'on' : ''} ${sidePane ? 'split' : ''}`}>
      {PANES.map(p =>
        opened.includes(p) ? (
          <Pane key={p} id={p} slot={slotOf(p, input)} active={active === p} main={main} ratio={ratio} hasSide={!!sidePane}>
            {p === 'reader' ? <Reader /> : p === 'board' ? <Board compact={slotOf(p, input) === 'side'} /> : <Cinema />}
          </Pane>
        ) : null,
      )}
      {sidePane && <Splitter ratio={ratio} host={host} />}
    </div>
  );
}

export { closePane };
