// Garden Studio panel, plant Inspect card (BM-02/03), garden journal (BM-05 lite) and the
// paper action card (every knowledge flower leads to real work, not just decoration).
import { setSide } from '../state/layout';
import { useState } from 'react';
import { appData } from '../apps/data';
import { focusOnPaper } from '../focus/FocusUI';
import { balance } from '../focus/engine';
import { focus } from '../focus/store';
import { openPaper, toast } from '../state/app';
import { Icon } from '../ui/icons';
import { beginPlacing, cancelPlacing, garden, isThirsty, isUnlocked, redoGarden, removeDecor, setCareSim, undoGarden, unlock, water } from './gardenState';
import { paperProgress } from './KnowledgeGarden';
import { CATALOG, catalogItem, Decor, type CatalogItem } from './plants';

const fa = new Intl.NumberFormat('en-US');
const faDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'long' }) : '—');

function CatalogTile({ c }: { c: CatalogItem }) {
  const rewardMode = focus.use(s => s.rewardMode);
  focus.use(s => s.ledger.length);
  const [color, setColor] = useState(c.colors?.[0]);
  const [confirm, setConfirm] = useState(false);
  const open = isUnlocked(c.kind, c.cost);
  const pick = () => {
    if (open) return beginPlacing(c.kind, color);
    setConfirm(true);
  };
  return (
    <div className={`cat-tile ${open ? '' : 'locked'}`}>
      <button className="cat-pick" onClick={pick} title={c.care}>
        <svg viewBox="-80 -190 160 200" width="56" height="64" aria-hidden>
          <Decor kind={c.kind} color={color} />
        </svg>
        <span>{c.label}</span>
        {!open && rewardMode && <small className="cost">💧 {fa.format(c.cost)}</small>}
      </button>
      {c.colors && open && (
        <div className="cat-colors">
          {c.colors.map(col => (
            <button key={col} className={`swatch ${col === color ? 'on' : ''}`} style={{ background: col }} onClick={() => setColor(col)} aria-label="Color" />
          ))}
        </div>
      )}
      {confirm && (
        <div className="cat-confirm">
          <span>Unlock for {fa.format(c.cost)} drops?</span>
          <button
            className="btn small primary"
            onClick={() => {
              setConfirm(false);
              if (unlock(c.kind, c.cost)) {
                toast(`${c.label} added to the catalog`, 'ok');
                beginPlacing(c.kind, color);
              } else toast('Not enough dew drops; a focus session earns more', 'warn');
            }}
          >
            Confirm
          </button>
          <button className="btn small" onClick={() => setConfirm(false)}>
            No
          </button>
        </div>
      )}
    </div>
  );
}

export function GardenStudio() {
  const { editing, placing, canUndo, canRedo, journal, careSim } = garden.use(s => s);
  const points = focus.use(s => balance(s.ledger));
  const rewardMode = focus.use(s => s.rewardMode);
  const [tab, setTab] = useState<'plants' | 'objects' | 'journal'>('plants');
  if (!editing)
    return (
      <div className="garden-tools">
        <button className="chip" onClick={() => garden.set({ editing: true, selected: null, hover: null, inspect: null, picked: null })}>
          <Icon name="edit" size={18} /> Garden studio
        </button>
      </div>
    );
  return (
    <div className="garden-studio card">
      <header className="card-h">
        <Icon name="leaf" />
        <h3>Garden studio</h3>
        {rewardMode && <span className="card-src">💧 {fa.format(points)}</span>}
        <button className="ibtn tiny" onClick={undoGarden} disabled={!canUndo} title="Undo">
          <Icon name="undo" size={16} />
        </button>
        <button className="ibtn tiny flip" onClick={redoGarden} disabled={!canRedo} title="Redo">
          <Icon name="undo" size={16} />
        </button>
        <button
          className="ibtn tiny"
          onClick={() => {
            cancelPlacing();
            garden.set({ editing: false, selected: null });
          }}
          title="Close"
        >
          <Icon name="close" size={16} />
        </button>
      </header>
      <div className="seg-row tabs">
        <button className={`chip ${tab === 'plants' ? 'on' : ''}`} onClick={() => setTab('plants')}>
          Plants
        </button>
        <button className={`chip ${tab === 'objects' ? 'on' : ''}`} onClick={() => setTab('objects')}>
          Objects
        </button>
        <button className={`chip ${tab === 'journal' ? 'on' : ''}`} onClick={() => setTab('journal')}>
          Garden journal
        </button>
      </div>
      {tab !== 'journal' ? (
        <div className="catalog">
          {CATALOG.filter(c => c.group === (tab === 'plants' ? 'plant' : 'object')).map(c => (
            <CatalogTile key={c.kind} c={c} />
          ))}
        </div>
      ) : (
        <ul className="journal">
          {journal.length === 0 && <li className="muted small">Nothing logged yet. Every planting, watering and move shows up here.</li>}
          {[...journal]
            .reverse()
            .slice(0, 40)
            .map((j, i) => (
              <li key={i}>
                <span>{j.text}</span>
                <small className="muted">{faDate(j.at)}</small>
              </li>
            ))}
        </ul>
      )}
      <p className="hint-dark">
        {placing
          ? `${catalogItem(placing.kind).label}: move over the greenhouse floor and click or pinch (green = good spot). Esc = cancel`
          : 'Choose a plant, or move planted ones by dragging with the mouse or a held pinch.'}
      </p>
      <label className="check">
        <input type="checkbox" checked={careSim} onChange={e => setCareSim(e.target.checked)} />
        Care simulation (thirst hints only; no plant ever dries out or disappears)
      </label>
    </div>
  );
}

/** Pinch/click a planted item when not editing: info + care actions (Botany Manor-style inspect). */
export function InspectCard() {
  const { inspect, decor, careSim } = garden.use(s => s);
  const d = decor.find(x => x.id === inspect);
  if (!d) return null;
  const c = catalogItem(d.kind);
  const thirsty = isThirsty(d, careSim);
  return (
    <div className="inspect card">
      <header className="card-h">
        <Icon name="leaf" />
        <h3>{c.label}</h3>
        <button className="ibtn tiny" onClick={() => garden.set({ inspect: null })} aria-label="Close">
          <Icon name="close" size={16} />
        </button>
      </header>
      <div className="inspect-body">
        <svg viewBox="-80 -190 160 200" width="110" height="130" aria-hidden>
          <Decor kind={d.kind} color={d.color} />
        </svg>
        <ul className="bullets plain">
          <li>Care: {c.care}</li>
          <li>Planted: {faDate(d.planted)}</li>
          {c.group === 'plant' && <li>Last watered: {faDate(d.watered)}{thirsty ? ' · a little thirsty' : ''}</li>}
          <li className="muted small">These details are decorative, not an accurate botany guide.</li>
        </ul>
      </div>
      <div className="inspect-actions">
        {c.group === 'plant' && (
          <button className="btn" onClick={() => water(d.id, c.label)}>
            <Icon name="drop" size={18} /> Water
          </button>
        )}
        <button className="btn" onClick={() => garden.set({ editing: true, selected: d.id, inspect: null })}>
          <Icon name="edit" size={18} /> Move
        </button>
        <ConfirmButton label="Remove" onConfirm={() => removeDecor(d.id, c.label)} />
      </div>
    </div>
  );
}

function ConfirmButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [ask, setAsk] = useState(false);
  return ask ? (
    <span className="confirm-inline">
      <button className="btn small danger-btn" onClick={onConfirm}>
        Sure
      </button>
      <button className="btn small" onClick={() => setAsk(false)}>
        No
      </button>
    </span>
  ) : (
    <button className="btn" onClick={() => setAsk(true)}>
      <Icon name="trash" size={18} /> {label}
    </button>
  );
}

/** Choosing a knowledge flower opens real actions for that paper. */
export function PaperActions() {
  const paper = garden.use(s => s.picked);
  appData.use(s => s.papers.length);
  if (!paper) return null;
  const prog = paperProgress(paper);
  return (
    <div className="inspect card paper-actions">
      <header className="card-h">
        <Icon name="book" />
        <h3 dir="auto" className="ellipsis">
          {paper.title}
        </h3>
        <button className="ibtn tiny" onClick={() => garden.set({ picked: null })} aria-label="Close">
          <Icon name="close" size={16} />
        </button>
      </header>
      <p className="paper-meta" dir="auto">
        {paper.authors} · {paper.venue} {paper.year}
      </p>
      <span className="bar">
        <span style={{ width: `${Math.round(prog * 100)}%` }} />
      </span>
      <p className="muted small">
        Progress {fa.format(Math.round(prog * 100))}% · p. {fa.format(paper.lastPage || 1)} of {fa.format(paper.pages || 0)} · {fa.format(paper.notes)} notes in Marginal
      </p>
      <div className="inspect-actions">
        <button
          className="btn primary"
          onClick={() => {
            garden.set({ picked: null });
            openPaper(paper);
          }}
        >
          <Icon name="book" size={18} /> Continue reading
        </button>
        <button
          className="btn"
          onClick={() => {
            garden.set({ picked: null });
            focusOnPaper({ kind: 'paper', id: paper.id, title: paper.title });
            openPaper(paper);
          }}
        >
          <Icon name="timer" size={18} /> Read with the focus timer
        </button>
        <button
          className="btn"
          onClick={() => {
            garden.set({ picked: null });
            setSide('board');
            openPaper(paper);
          }}
        >
          <Icon name="split" size={18} /> With the knowledge board
        </button>
      </div>
    </div>
  );
}
