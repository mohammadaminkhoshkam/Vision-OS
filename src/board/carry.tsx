// Carrying content onto the knowledge board — one gesture for mouse and hand (AFFiNE's idea of
// putting quotes, images and AI answers straight on the canvas). Anything marked with
// `carryProps(clip)` can be dragged with the mouse (HTML drag and drop) or pinch-dragged with the
// hand; dropping it over a board creates a card at that spot, keeping its source and page.
import { useState } from 'react';
import { createStore } from '../lib/store';
import { Icon } from '../ui/icons';
import { useVisionHandler } from '../vision/router';
import { CLIP_MIME, type Clip } from './model';

export const BOARD_DROP = 'vos-board-drop';
export interface BoardDropDetail {
  clip: Clip;
  x: number;
  y: number;
}

const carry = createStore({ clip: null as Clip | null, x: 0, y: 0 });

/** Props that make an element a carry source for both mouse and hand. */
export function carryProps(clip: Clip | null) {
  if (!clip) return {};
  return {
    draggable: true,
    'data-carry': '',
    title: 'Drag onto the knowledge board',
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData(CLIP_MIME, JSON.stringify(clip));
      e.dataTransfer.setData('text/plain', clip.text);
      e.dataTransfer.effectAllowed = 'copy';
      document.documentElement.dataset.carrying = '1';
    },
    onDragEnd: () => delete document.documentElement.dataset.carrying,
    // the hand reads the payload from here
    'data-clip': JSON.stringify(clip),
  };
}

function boardAt(x: number, y: number) {
  return document.elementFromPoint(x, y)?.closest('.board-host') ?? null;
}

/** Ghost that follows the hand while carrying, and the drop logic. Mounted once in the shell. */
export function CarryLayer() {
  const { clip, x, y } = carry.use(s => s);
  const [over, setOver] = useState(false);
  useVisionHandler((e, px) => {
    if (e.type === 'DRAG_START' && px) {
      const el = document.elementFromPoint(px.x, px.y)?.closest('[data-carry]');
      const raw = el?.getAttribute('data-clip');
      if (!raw) return false;
      try {
        carry.set({ clip: JSON.parse(raw), x: px.x, y: px.y });
        document.documentElement.dataset.carrying = '1';
        return true;
      } catch {
        return false;
      }
    }
    if (!carry.get().clip) return false;
    if (e.type === 'DRAG_MOVE' && px) {
      carry.set({ x: px.x, y: px.y });
      setOver(!!boardAt(px.x, px.y));
      return true;
    }
    if (e.type === 'DRAG_END') {
      const c = carry.get();
      if (c.clip && boardAt(c.x, c.y)) dispatchEvent(new CustomEvent<BoardDropDetail>(BOARD_DROP, { detail: { clip: c.clip, x: c.x, y: c.y } }));
      carry.set({ clip: null });
      setOver(false);
      delete document.documentElement.dataset.carrying;
      return true;
    }
    return false;
  }, []);
  if (!clip) return null;
  return (
    <div className={`carry-ghost ${over ? 'over' : ''}`} style={{ left: x, top: y }} aria-hidden>
      <Icon name={clip.type === 'figure' ? 'lens' : clip.type === 'ai' ? 'sparkle' : clip.type === 'video' ? 'youtube' : 'highlight'} size={16} />
      <span dir="auto">{clip.text.slice(0, 80) || 'Figure'}</span>
    </div>
  );
}
