// Spatial Knowledge Board (SR-02/03): infinite canvas of clips, notes and video moments,
// each card linked back to its exact source. Mouse, keyboard and hand gestures all work.
import { useEffect, useRef, useState } from 'react';
import { appData } from '../apps/data';
import { openPaper, openVideo, toast } from '../state/app';
import { Icon, type IconName } from '../ui/icons';
import { useRadialItems, useVisionHandler } from '../vision/router';
import { usePane } from '../state/pane';
import { CLIP_MIME, dropClip, fitView, frameAround, inFrame, link, moveGroup, NOTE_COLORS, paperMap, parseClip, removeNode, setEdgeLabel, unlink, updateNode, type BoardNode, type Clip } from './model';
import { BOARD_DROP, type BoardDropDetail } from './carry';
import { currentRelations } from '../discovery/store';
import { paperProgress } from '../garden/KnowledgeGarden';
import { addNote, board, commit, history, live, redo, setView, undo } from './store';
import { openAssistant } from '../ai/store';

const TYPE_ICON: Record<BoardNode['type'], IconName> = { text: 'highlight', figure: 'lens', note: 'edit', video: 'youtube', ai: 'sparkle', frame: 'split', paper: 'book' };
const TYPE_LABEL: Record<BoardNode['type'], string> = { text: 'Text clip', figure: 'Figure', note: 'Note', video: 'Video moment', ai: 'AI answer', frame: 'Frame', paper: 'Paper' };
const fa = new Intl.NumberFormat('en-US');
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function openSource(n: BoardNode) {
  const s = n.source;
  if (!s) return;
  if (s.kind === 'video') return openVideo(s.videoId, s.t);
  const paper = appData.get().papers.find(p => p.id === s.paperId || `m-${p.id}` === s.docId);
  if (paper) return openPaper(paper, s.page);
  toast('This clip comes from a local file; open the file in the reader again', 'warn');
}

function FrameCard({ n, selected }: { n: BoardNode; selected: boolean }) {
  return (
    <div className={`bframe ${selected ? 'sel' : ''}`} data-node={n.id} style={{ left: n.x, top: n.y, width: n.w, height: n.h ?? 320 }} onClick={() => board.set({ selected: n.id })}>
      <div className="bframe-h" data-drag={n.id}>
        <input
          value={n.text}
          dir="auto"
          aria-label="Frame title"
          onChange={e => live(updateNode(board.get().doc, n.id, { text: e.target.value }))}
          onBlur={() => commit(history.present)}
          onPointerDown={e => e.stopPropagation()}
        />
        {selected && (
          <button className="ibtn tiny" onClick={e => (e.stopPropagation(), commit(removeNode(board.get().doc, n.id)), board.set({ selected: null }))} title="Delete the frame (keeps its cards)">
            <Icon name="trash" size={14} />
          </button>
        )}
      </div>
      <span className="bframe-resize" data-resize={n.id} aria-label="Resize frame" />
    </div>
  );
}

function PaperCard({ n, selected, linking }: { n: BoardNode; selected: boolean; linking: string | null }) {
  const paper = appData.use(s => s.papers.find(p => p.id === n.paperId));
  const prog = paper ? paperProgress(paper) : 0;
  return (
    <div
      className={`bcard bcard-paper ${selected ? 'sel' : ''} ${linking === n.id ? 'linking' : ''}`}
      data-node={n.id}
      style={{ left: n.x, top: n.y, width: n.w }}
      onClick={() => {
        const st = board.get();
        if (st.linking && st.linking !== n.id) {
          commit(link(st.doc, st.linking, n.id));
          board.set({ linking: null });
        } else board.set({ selected: n.id });
      }}
    >
      <div className="bcard-h" data-drag={n.id}>
        <Icon name="book" size={16} />
        <span>Paper</span>
        {paper && (
          <button className="cite" onClick={e => (e.stopPropagation(), openPaper(paper))} title="Open the paper">
            Open · {fa.format(Math.round(prog * 100))}%
          </button>
        )}
      </div>
      <p className="paper-node-title" dir="auto">
        {n.text}
      </p>
      <div className="bar">
        <span style={{ width: `${Math.round(prog * 100)}%` }} />
      </div>
      {selected && (
        <div className="bcard-actions">
          <button className="ibtn tiny" onClick={e => (e.stopPropagation(), board.set({ linking: n.id }))} title="Connect to another card">
            <Icon name="leaf" size={14} />
          </button>
          <button className="ibtn tiny" onClick={e => (e.stopPropagation(), commit(removeNode(board.get().doc, n.id)), board.set({ selected: null }))} title="Remove from the map">
            <Icon name="trash" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function Card({ n, selected, linking }: { n: BoardNode; selected: boolean; linking: string | null }) {
  const s = n.source;
  if (n.type === 'frame') return <FrameCard n={n} selected={selected} />;
  if (n.type === 'paper') return <PaperCard n={n} selected={selected} linking={linking} />;
  return (
    <div
      className={`bcard bcard-${n.type} ${selected ? 'sel' : ''} ${linking === n.id ? 'linking' : ''}`}
      data-node={n.id}
      style={{ left: n.x, top: n.y, width: n.w, ...(n.type === 'note' && n.color ? { ['--note' as string]: n.color } : {}) }}
      onPointerDown={e => {
        // only the header (not its buttons) starts a card drag on the host
        const t = e.target as Element;
        if (!t.closest('[data-drag]') || t.closest('button')) e.stopPropagation();
      }}
      onClick={() => {
        const st = board.get();
        if (st.linking && st.linking !== n.id) {
          commit(link(st.doc, st.linking, n.id));
          board.set({ linking: null });
          toast('Two cards connected', 'ok');
        } else board.set({ selected: n.id });
      }}
    >
      <div className="bcard-h" data-drag={n.id}>
        <Icon name={TYPE_ICON[n.type]} size={16} />
        <span>{TYPE_LABEL[n.type]}</span>
        {s && (
          <button className="cite" onClick={e => (e.stopPropagation(), openSource(n))} title="Open source" dir="auto">
            {s.kind === 'pdf' ? `${s.title.slice(0, 26)}… · p. ${fa.format(s.page)}` : `${s.title.slice(0, 22)}… · ${fmt(s.t)}`}
          </button>
        )}
      </div>
      {n.image && <img src={n.image} alt={n.text || 'figure clip'} draggable={false} />}
      {n.type === 'note' || selected ? (
        <textarea
          value={n.text}
          dir="auto"
          placeholder={n.type === 'figure' ? 'Your take on this figure…' : 'Note…'}
          onChange={e => live(updateNode(board.get().doc, n.id, { text: e.target.value }))}
          onBlur={() => commit(history.present)}
          onPointerDown={e => e.stopPropagation()}
        />
      ) : (
        n.text && (
          <p dir="auto" className={n.type === 'text' ? 'quote' : ''}>
            {n.text}
          </p>
        )
      )}
      {selected && (
        <div className="bcard-actions">
          <button className="ibtn tiny" onClick={e => (e.stopPropagation(), board.set({ linking: n.id }))} title="Connect to another card">
            <Icon name="leaf" size={14} />
          </button>
          {n.type === 'note' &&
            NOTE_COLORS.map(c => (
              <button key={c} className={`swatch tiny ${n.color === c ? 'on' : ''}`} style={{ background: c }} onClick={e => (e.stopPropagation(), commit(updateNode(board.get().doc, n.id, { color: c })))} aria-label="Note colour" />
            ))}
          {n.type !== 'ai' && (
            <button
              className="ibtn tiny"
              onClick={e => {
                e.stopPropagation();
                openAssistant({ excerpt: n.type === 'figure' ? n.text : n.text, image: n.image, source: n.source, fromNode: n.id }, n.image ? 'explain' : undefined);
              }}
              title="Ask the AI about this card"
            >
              <Icon name="sparkle" size={14} />
            </button>
          )}
          {s && (
            <button className="ibtn tiny" onClick={e => (e.stopPropagation(), openSource(n))} title="Open source">
              <Icon name="book" size={14} />
            </button>
          )}
          <button className="ibtn tiny" onClick={e => (e.stopPropagation(), commit(removeNode(board.get().doc, n.id)), board.set({ selected: null }))} title="Delete">
            <Icon name="trash" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export function Board({ compact = false }: { compact?: boolean }) {
  const { doc, view, linking, selected, canUndo, canRedo } = board.use(s => s);
  const host = useRef<HTMLDivElement>(null);
  const { active } = usePane();
  const activeRef = useRef(active);
  activeRef.current = active;
  const drag = useRef<
    | null
    | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number }
    | { kind: 'node'; id: string; sx: number; sy: number; starts: Record<string, { x: number; y: number }> }
    | { kind: 'resize'; id: string; sx: number; sy: number; w: number; h: number }
  >(null);
  const [edgeSel, setEdgeSel] = useState<string | null>(null);

  const local = (cx: number, cy: number) => {
    const r = host.current!.getBoundingClientRect();
    return { x: cx - r.left, y: cy - r.top };
  };
  const zoomAt = (factor: number, cx?: number, cy?: number) => {
    const v = board.get().view;
    const r = host.current!.getBoundingClientRect();
    const px = cx !== undefined ? cx - r.left : r.width / 2, py = cy !== undefined ? cy - r.top : r.height / 2;
    const scale = Math.min(2.5, Math.max(0.2, v.scale * factor));
    const k = scale / v.scale;
    setView({ scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k });
  };

  const begin = (cx: number, cy: number, target: Element | null) => {
    const id = target?.closest('[data-drag]')?.getAttribute('data-drag');
    const rid = target?.closest('[data-resize]')?.getAttribute('data-resize');
    const v = board.get().view;
    const doc = board.get().doc;
    if (rid) {
      const f = doc.nodes.find(x => x.id === rid)!;
      drag.current = { kind: 'resize', id: rid, sx: cx, sy: cy, w: f.w, h: f.h ?? 320 };
    } else if (id) {
      // a frame carries the cards inside it (tldraw-style)
      const ids = [id, ...inFrame(doc, id)];
      const starts = Object.fromEntries(ids.map(i => { const n = doc.nodes.find(x => x.id === i)!; return [i, { x: n.x, y: n.y }]; }));
      drag.current = { kind: 'node', id, sx: cx, sy: cy, starts };
      board.set({ selected: id });
    } else if (!target?.closest('.bcard, .bframe-h, .board-tools, .edge, .edge-editor')) drag.current = { kind: 'pan', sx: cx, sy: cy, vx: v.x, vy: v.y };
    return !!drag.current;
  };
  const move = (cx: number, cy: number) => {
    const d = drag.current;
    if (!d) return;
    const k = board.get().view.scale;
    if (d.kind === 'pan') setView({ ...board.get().view, x: d.vx + cx - d.sx, y: d.vy + cy - d.sy });
    else if (d.kind === 'resize') live(updateNode(board.get().doc, d.id, { w: Math.max(200, d.w + (cx - d.sx) / k), h: Math.max(140, d.h + (cy - d.sy) / k) }));
    else live(moveGroup(board.get().doc, d.starts, (cx - d.sx) / k, (cy - d.sy) / k));
  };
  const end = () => {
    if (drag.current?.kind === 'node' || drag.current?.kind === 'resize') commit(history.present);
    drag.current = null;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!activeRef.current) return;
      if (e.target instanceof Element && e.target.closest('input, textarea')) return;
      if (e.ctrlKey && e.key.toLowerCase() === 'z') (e.preventDefault(), undo());
      else if (e.ctrlKey && e.key.toLowerCase() === 'y') (e.preventDefault(), redo());
      else if (e.key === 'Delete' && board.get().selected) {
        commit(removeNode(board.get().doc, board.get().selected!));
        board.set({ selected: null });
      } else if (e.key === 'Escape') board.set({ linking: null, selected: null });
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  // dropping content on the board: clips carried from the reader, the AI panel or a video
  // (mouse drag-and-drop or hand pinch-carry), plain text, or an image file
  const toWorld = (cx: number, cy: number) => {
    const p = local(cx, cy), v = board.get().view;
    return { x: (p.x - v.x) / v.scale, y: (p.y - v.y) / v.scale };
  };
  const place = (clip: Clip, cx: number, cy: number) => {
    const next = dropClip(board.get().doc, clip, toWorld(cx, cy));
    commit(next);
    board.set({ selected: next.nodes[next.nodes.length - 1].id });
    toast('Added to the knowledge board', 'ok');
  };
  useEffect(() => {
    const on = (e: Event) => {
      const { clip, x, y } = (e as CustomEvent<BoardDropDetail>).detail;
      const r = host.current?.getBoundingClientRect();
      if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) place(clip, x, y);
    };
    addEventListener(BOARD_DROP, on);
    return () => removeEventListener(BOARD_DROP, on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    host.current?.classList.remove('drop-over');
    const clip = parseClip(e.dataTransfer.getData(CLIP_MIME));
    if (clip) return place(clip, e.clientX, e.clientY);
    const file = [...e.dataTransfer.files].find(f => f.type.startsWith('image/') && f.size < 4e6);
    if (file) {
      const { clientX, clientY } = e;
      const fr = new FileReader();
      fr.onload = () => place({ type: 'figure', text: file.name, image: String(fr.result), source: null }, clientX, clientY);
      return fr.readAsDataURL(file);
    }
    const text = e.dataTransfer.getData('text/plain').trim();
    if (text) place({ type: 'note', text: text.slice(0, 4000), source: null }, e.clientX, e.clientY);
  };

  const addFrame = () => {
    const st = board.get();
    const r = host.current?.getBoundingClientRect();
    const at = r ? toWorld(r.left + r.width / 2 - 200, r.top + r.height / 2 - 150) : { x: 0, y: 0 };
    commit(frameAround(st.doc, st.selected && st.doc.nodes.find(n => n.id === st.selected)?.type !== 'frame' ? [st.selected] : [], at));
  };
  const mapPapers = () => {
    const papers = appData.get().papers.map(p => ({ id: p.id, title: p.title }));
    const related = currentRelations().map(r => [r.a, r.b, r.terms.slice(0, 2).join(', ')] as [string, string, string]);
    const before = board.get().doc;
    const next = paperMap(before, papers, related);
    if (next === before) return toast('Clip something from a paper first; the map gathers clips around their papers', 'info');
    commit(next);
    if (host.current) setView(fitView(next, host.current.clientWidth, host.current.clientHeight));
    toast('Paper map updated: clips are linked to their papers, related papers to each other', 'ok');
  };

  // hand: pinch-drag a card header to move it, pinch-drag empty space to pan, two hands to zoom
  useVisionHandler(
    (e, px) => {
      const r = host.current?.getBoundingClientRect();
      const inside = px && r && px.x >= r.left && px.x <= r.right && px.y >= r.top && px.y <= r.bottom;
      if (e.type === 'DRAG_START' && inside) return begin(px.x, px.y, document.elementFromPoint(px.x, px.y));
      if (e.type === 'DRAG_MOVE' && drag.current && px) return move(px.x, px.y), true;
      if (e.type === 'DRAG_END' && drag.current) return end(), true;
      if (e.type === 'ZOOM' && !compact) return zoomAt(e.scale), true;
      return false;
    },
    [compact],
  );

  useRadialItems(
    compact
      ? []
      : [
          { id: 'note', label: 'Note', icon: 'edit', run: () => addNote() },
          { id: 'fit', label: 'Fit', icon: 'expand', run: () => host.current && setView(fitView(board.get().doc, host.current.clientWidth, host.current.clientHeight)) },
          { id: 'undo', label: 'Undo', icon: 'undo', run: undo },
        ],
    [compact],
  );

  const byId = new Map(doc.nodes.map(n => [n.id, n]));
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vision-board-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  return (
    <div className={`board ${compact ? 'compact' : ''} ${linking ? 'is-linking' : ''}`}>
      <div
        className="board-host"
        ref={host}
        onPointerDown={e => {
          if (begin(e.clientX, e.clientY, e.target as Element)) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          if (!(e.target as Element).closest('.bcard')) board.set({ selected: null });
        }}
        onPointerMove={e => move(e.clientX, e.clientY)}
        onPointerUp={end}
        onWheel={e => zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX, e.clientY)}
        onDragOver={e => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          host.current?.classList.add('drop-over');
        }}
        onDragLeave={e => e.currentTarget === e.target && host.current?.classList.remove('drop-over')}
        onDrop={onDrop}
        onDoubleClick={e => {
          if ((e.target as Element).closest('.bcard')) return;
          const p = local(e.clientX, e.clientY);
          addNote((p.x - view.x) / view.scale, (p.y - view.y) / view.scale);
        }}
      >
        <div className="board-grid" style={{ backgroundPosition: `${view.x}px ${view.y}px`, backgroundSize: `${40 * view.scale}px ${40 * view.scale}px` }} />
        <div className="board-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
          {/* frames sit underneath the links and the cards they hold */}
          {doc.nodes
            .filter(n => n.type === 'frame')
            .map(n => (
              <Card key={n.id} n={n} selected={selected === n.id} linking={linking} />
            ))}
          <svg className="board-edges" width="1" height="1">
            {doc.edges.map(ed => {
              const a = byId.get(ed.from), b = byId.get(ed.to);
              if (!a || !b) return null;
              const ax = a.x + a.w / 2, ay = a.y + 60, bx = b.x + b.w / 2, by = b.y + 60;
              const mx = (ax + bx) / 2;
              return (
                <g key={ed.id} className={`edge ${edgeSel === ed.id ? 'sel' : ''}`} onClick={() => setEdgeSel(edgeSel === ed.id ? null : ed.id)}>
                  <path d={`M${ax},${ay} C${mx},${ay} ${mx},${by} ${bx},${by}`} />
                  <circle cx={(ax + bx) / 2} cy={(ay + by) / 2} r={5} />
                  {ed.label && edgeSel !== ed.id && (
                    <text x={(ax + bx) / 2} y={(ay + by) / 2 - 10} textAnchor="middle" className="edge-label">
                      {ed.label}
                    </text>
                  )}
                  {edgeSel === ed.id && (
                    <foreignObject x={(ax + bx) / 2 - 110} y={(ay + by) / 2 - 52} width={220} height={40}>
                      <div className="edge-editor" onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
                        <input
                          autoFocus
                          defaultValue={ed.label ?? ''}
                          placeholder="Label (supports, contradicts…)"
                          onKeyDown={e => {
                            if (e.key === 'Enter') (commit(setEdgeLabel(board.get().doc, ed.id, e.currentTarget.value)), setEdgeSel(null));
                            if (e.key === 'Escape') setEdgeSel(null);
                          }}
                          onBlur={e => commit(setEdgeLabel(board.get().doc, ed.id, e.currentTarget.value))}
                        />
                        <button className="ibtn tiny" onClick={() => (commit(unlink(board.get().doc, ed.id)), setEdgeSel(null))} title="Remove the link" aria-label="Remove the link">
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    </foreignObject>
                  )}
                </g>
              );
            })}
          </svg>
          {doc.nodes
            .filter(n => n.type !== 'frame')
            .map(n => (
              <Card key={n.id} n={n} selected={selected === n.id} linking={linking} />
            ))}
        </div>
        {doc.nodes.length === 0 && (
          <div className="board-empty">
            <Icon name="leaf" size={34} />
            <p>The knowledge board is empty.</p>
            <p className="muted small">Drag a highlight, a selection, an AI answer or an image onto this board (or pinch-carry it with your hand). In the reader you can also select text and press “Clip to board”, or draw around a chart with the “Clip figure” tool. In YouTube you can also send any bookmark to the board. Double-click for a new note.</p>
          </div>
        )}
      </div>
      <div className="board-tools" data-vision-ignore={undefined}>
        <button className="ibtn" onClick={() => addNote()} title="New note">
          <Icon name="plus" />
        </button>
        <button className="ibtn" onClick={() => zoomAt(1 / 1.2)} title="Zoom out">
          <Icon name="minus" />
        </button>
        <span className="page-ind">{fa.format(Math.round(view.scale * 100))}%</span>
        <button className="ibtn" onClick={() => zoomAt(1.2)} title="Zoom in">
          <Icon name="plus" />
        </button>
        <button className="ibtn" onClick={() => host.current && setView(fitView(doc, host.current.clientWidth, host.current.clientHeight))} title="Fit all">
          <Icon name="expand" />
        </button>
        <button className="ibtn" onClick={addFrame} title="Frame: group the selected card (or start an empty frame)">
          <Icon name="split" />
        </button>
        <button className="ibtn" onClick={mapPapers} title="Paper map: link clips to their papers and related papers to each other">
          <Icon name="network" />
        </button>
        <button className="ibtn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <Icon name="undo" />
        </button>
        <button className="ibtn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
          <Icon name="undo" />
        </button>
        {!compact && (
          <button className="ibtn" onClick={exportJson} title="Export JSON">
            <Icon name="file" />
          </button>
        )}
        {linking && <span className="link-hint">Select the second card (Esc to cancel)</span>}
      </div>
    </div>
  );
}
