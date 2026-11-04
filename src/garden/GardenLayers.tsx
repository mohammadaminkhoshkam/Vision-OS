// Interactive layers drawn inside the scene SVG on the Home screen: decorative garden
// (place / move / inspect) and the Knowledge Garden (one flower per paper).
import { useRef } from 'react';
import { appData } from '../apps/data';
import { app, go } from '../state/app';
import { workspace } from '../state/workspace';
import { useVisionHandler } from '../vision/router';
import { commitMove, garden, isThirsty, moveDecorLive, placeAtGhost, updateGhost } from './gardenState';
import { DecorLayer, KnowledgeGarden } from './KnowledgeGarden';
import { catalogItem } from './plants';

function toScene(clientX: number, clientY: number) {
  const svg = document.querySelector<SVGSVGElement>('.scene-svg');
  const m = svg?.getScreenCTM();
  if (!svg || !m) return null;
  const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
  return { x: p.x, y: p.y };
}

export function GardenLayers() {
  const papers = appData.use(s => s.papers);
  const showProgress = app.use(s => s.gardenProgress);
  const preset = app.use(s => s.preset);
  const last = workspace.use(s => s.recent[0]);
  const active = last?.kind === 'paper' ? { id: last.id, page: last.page } : null;
  const { decor, editing, selected, placing, ghost, careSim } = garden.use(s => s);
  // over the photograph the decorative layer would duplicate real objects; it returns in the studio
  const photo = preset === 'photo' && !editing;
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const begin = (id: string, clientX: number, clientY: number) => {
    const p = toScene(clientX, clientY);
    const it = garden.get().decor.find(d => d.id === id);
    if (!p || !it) return;
    drag.current = { id, dx: it.x - p.x, dy: it.y - p.y };
    garden.set({ selected: id });
  };
  const move = (clientX: number, clientY: number) => {
    const d = drag.current;
    const p = toScene(clientX, clientY);
    if (d && p) moveDecorLive(d.id, p.x + d.dx, p.y + d.dy);
  };
  const end = () => {
    if (drag.current) commitMove(drag.current.id);
    drag.current = null;
  };

  const onPointerDown = (id: string, e: React.PointerEvent) => {
    if (garden.get().placing) return;
    e.preventDefault();
    begin(id, e.clientX, e.clientY);
    const mv = (ev: PointerEvent) => move(ev.clientX, ev.clientY);
    const up = () => {
      end();
      removeEventListener('pointermove', mv);
      removeEventListener('pointerup', up);
    };
    addEventListener('pointermove', mv);
    addEventListener('pointerup', up);
  };

  const place = () => {
    const p = garden.get().placing;
    if (p) placeAtGhost(catalogItem(p.kind).label);
  };

  // hand: the ghost follows the cursor while placing; pinch places it. Pinch-drag moves items in edit mode.
  useVisionHandler(
    (e, px) => {
      const st = garden.get();
      if (st.placing && px) {
        if (e.type === 'POINTER_MOVE') {
          const p = toScene(px.x, px.y);
          if (p) updateGhost(p.x, p.y);
          return false;
        }
        if (e.type === 'CLICK' && !document.elementFromPoint(px.x, px.y)?.closest('button')) return place(), true;
      }
      if (!st.editing || !px) return false;
      if (e.type === 'DRAG_START') {
        const id = document.elementFromPoint(px.x, px.y)?.closest('[data-decor]')?.getAttribute('data-decor');
        if (!id) return false;
        begin(id, px.x, px.y);
        return true;
      }
      if (e.type === 'DRAG_MOVE' && drag.current) return move(px.x, px.y), true;
      if (e.type === 'DRAG_END' && drag.current) return end(), true;
      return false;
    },
    [],
  );

  return (
    <>
      {placing && (
        <rect
          className="placement-catcher"
          x={0}
          y={0}
          width={1600}
          height={900}
          fill="transparent"
          onPointerMove={e => {
            const p = toScene(e.clientX, e.clientY);
            if (p) updateGhost(p.x, p.y);
          }}
          onClick={place}
        />
      )}
      {!photo && (
      <DecorLayer
        items={decor}
        editing={editing}
        selected={selected}
        careSim={careSim}
        thirsty={d => isThirsty(d, careSim)}
        ghost={placing && ghost ? { ...ghost, kind: placing.kind, color: placing.color } : null}
        onPointerDown={onPointerDown}
        onInspect={id => garden.set({ inspect: id, picked: null })}
      />
      )}
      {!editing && (
        <KnowledgeGarden
          papers={papers}
          showProgress={showProgress}
          onOpen={p => garden.set({ picked: p, inspect: null })}
          onHover={(paper, el) => garden.set({ hover: paper && el ? { paper, rect: el.getBoundingClientRect() } : null })}
          onLibrary={() => go('library')}
          photo={photo}
          active={active}
        />
      )}
    </>
  );
}
