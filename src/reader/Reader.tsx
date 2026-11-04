// Vision Reading Mode: reading-first PDF view with big controls, highlights snapped to the
// text layer, freehand pen, precision lens, bookmarks and focus mode — all hand-controllable.
import * as pdfjs from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { platform } from '../platform';
import { app, controls, toast } from '../state/app';
import { Icon } from '../ui/icons';
import { cursorPx, useRadialItems, useVisionHandler, type Px } from '../vision/router';
import { loadNotes, mergeLineRects, saveNotes, uid, type DocNotes, type NRect } from './annotations';
import { Board } from '../board/Board';
import type { Source } from '../board/model';
import { clipFigure, clipText, cropToDataUrl } from '../board/store';
import { openAssistant } from '../ai/store';
import type { Action } from '../ai/prompts';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';

type Tool = 'select' | 'highlight' | 'pen' | 'clip';
const HL_COLORS = ['#ffd84d', '#8fe08a', '#7cc8ff', '#ff9bb3'];
const faNum = new Intl.NumberFormat('en-US');

function PageView({
  doc,
  n,
  scale,
  baseSize,
  notes,
  tool,
  onDrawStroke,
  onClip,
}: {
  doc: pdfjs.PDFDocumentProxy;
  n: number;
  scale: number;
  baseSize: { w: number; h: number };
  notes: DocNotes;
  tool: Tool;
  onDrawStroke: (page: number, pts: [number, number][]) => void;
  onClip: (pageEl: HTMLElement, page: number, a: [number, number], b: [number, number]) => void;
}) {
  const [region, setRegion] = useState<{ a: [number, number]; b: [number, number] } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const textDiv = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [drawing, setDrawing] = useState<[number, number][] | null>(null);
  const w = baseSize.w * scale, h = baseSize.h * scale;

  useEffect(() => {
    const el = wrap.current!;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let task: pdfjs.RenderTask | null = null;
    (async () => {
      const page = await doc.getPage(n);
      if (cancelled) return;
      const vp = page.getViewport({ scale });
      const dpr = Math.min(2, devicePixelRatio || 1);
      const c = canvas.current!;
      c.width = Math.floor(vp.width * dpr);
      c.height = Math.floor(vp.height * dpr);
      task = page.render({ canvas: c, canvasContext: c.getContext('2d')!, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
      await task.promise.catch(() => {});
      if (cancelled) return;
      const td = textDiv.current!;
      td.replaceChildren();
      td.style.setProperty('--scale-factor', String(scale));
      td.style.setProperty('--total-scale-factor', String(scale));
      td.style.setProperty('--user-unit', '1');
      const tl = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: td, viewport: vp });
      await tl.render().catch(() => {});
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, n, scale, visible]);

  const local = (e: React.PointerEvent): [number, number] => {
    const r = wrap.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };

  return (
    <div className="pdf-page" ref={wrap} data-page={n} style={{ width: w, height: h }}>
      <canvas ref={canvas} style={{ width: w, height: h }} />
      <div className="textLayer" ref={textDiv} />
      <svg className="anno" viewBox="0 0 1 1" preserveAspectRatio="none">
        {notes.highlights
          .filter(x => x.page === n)
          .flatMap(x => x.rects.map((r, i) => <rect key={x.id + i} x={r[0]} y={r[1]} width={r[2]} height={r[3]} fill={x.color} className="hl" />))}
        {[...notes.strokes.filter(s => s.page === n), ...(drawing ? [{ id: 'live', pts: drawing, color: '#c0392b', width: 0.003 }] : [])].map(s => (
          <polyline key={s.id} points={s.pts.map(p => p.join(',')).join(' ')} fill="none" stroke={s.color} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" vectorEffect="none" />
        ))}
      </svg>
      {tool === 'pen' && (
        <div
          className="pen-surface"
          onPointerDown={e => {
            capture(e);
            setDrawing([local(e)]);
          }}
          onPointerMove={e => drawing && setDrawing([...drawing, local(e)])}
          onPointerUp={() => {
            if (drawing && drawing.length > 1) onDrawStroke(n, drawing);
            setDrawing(null);
          }}
        />
      )}
      {tool === 'clip' && (
        <div
          className="pen-surface clip-surface"
          onPointerDown={e => {
            capture(e);
            const p = local(e);
            setRegion({ a: p, b: p });
          }}
          onPointerMove={e => region && setRegion({ ...region, b: local(e) })}
          onPointerUp={() => {
            if (region && wrap.current) onClip(wrap.current, n, region.a, region.b);
            setRegion(null);
          }}
        >
          {region && (
            <div
              className="sel-box"
              style={{
                left: `${Math.min(region.a[0], region.b[0]) * 100}%`,
                top: `${Math.min(region.a[1], region.b[1]) * 100}%`,
                width: `${Math.abs(region.a[0] - region.b[0]) * 100}%`,
                height: `${Math.abs(region.a[1] - region.b[1]) * 100}%`,
              }}
            />
          )}
        </div>
      )}
      {notes.bookmarks.includes(n) && (
        <div className="page-bm">
          <Icon name="bookmark" size={22} fill />
        </div>
      )}
    </div>
  );
}

/** Pointer capture keeps a drag alive outside the page; failing to capture must not break the tool. */
function capture(e: React.PointerEvent) {
  try {
    (e.target as Element).setPointerCapture(e.pointerId);
  } catch {
    /* synthetic or already-released pointer */
  }
}

function pageAt(px: Px): { el: HTMLElement; n: number; nx: number; ny: number } | null {
  const el = document.elementFromPoint(px.x, px.y)?.closest<HTMLElement>('.pdf-page');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { el, n: Number(el.dataset.page), nx: (px.x - r.left) / r.width, ny: (px.y - r.top) / r.height };
}

/** Snap a dragged region to the words of the text layer underneath it. */
function snapToText(pageEl: HTMLElement, a: [number, number], b: [number, number]): { rects: NRect[]; text: string } {
  const pr = pageEl.getBoundingClientRect();
  const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
  const rects: NRect[] = [];
  const words: string[] = [];
  for (const span of pageEl.querySelectorAll<HTMLElement>('.textLayer span')) {
    const r = span.getBoundingClientRect();
    if (!r.width) continue;
    const nr: NRect = [(r.left - pr.left) / pr.width, (r.top - pr.top) / pr.height, r.width / pr.width, r.height / pr.height];
    const cy = nr[1] + nr[3] / 2;
    if (cy >= y0 - 0.004 && cy <= y1 + 0.004 && nr[0] + nr[2] >= x0 && nr[0] <= x1) {
      rects.push(nr);
      words.push(span.textContent ?? '');
    }
  }
  if (!rects.length) rects.push([x0, y0, x1 - x0, Math.max(0.01, y1 - y0)]);
  return { rects: mergeLineRects(rects), text: words.join(' ') };
}

export function Reader() {
  const docRef = app.use(s => s.doc);
  const focus = app.use(s => s.focus);
  const split = app.use(s => s.split);
  const [pdf, setPdf] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [baseSize, setBaseSize] = useState({ w: 612, h: 792 });
  const [scale, setScale] = useState(1.25);
  const [page, setPage] = useState(1);
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState(HL_COLORS[0]);
  const [lens, setLens] = useState(false);
  const [lensAt, setLensAt] = useState<Px | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selRect, setSelRect] = useState<{ n: number; a: [number, number]; b: [number, number] } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const lensCanvas = useRef<HTMLCanvasElement>(null);

  const docId = useMemo(() => (docRef ? (docRef.source === 'marginal' ? `m-${docRef.paper.id}` : `f-${docRef.name}-${docRef.data.byteLength}`) : ''), [docRef]);
  const [notes, setNotes] = useState<DocNotes>(() => loadNotes(docId));
  const update = useCallback(
    (fn: (n: DocNotes) => DocNotes) =>
      setNotes(n => {
        const next = fn(n);
        saveNotes(docId, next);
        return next;
      }),
    [docId],
  );

  // load the document
  useEffect(() => {
    if (!docRef) return;
    let dead = false;
    setPdf(null);
    setError(null);
    const saved = loadNotes(docId);
    setNotes(saved);
    (async () => {
      try {
        const data = docRef.source === 'marginal' ? await platform.marginalPdf(docRef.paper.pdf) : docRef.data.slice(0);
        const doc = await pdfjs.getDocument({ data: new Uint8Array(data), cMapUrl: '/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/pdfjs/standard_fonts/' }).promise;
        if (dead) return;
        const first = await doc.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        setBaseSize({ w: vp.width, h: vp.height });
        const avail = (scroller.current?.clientWidth ?? 1000) - 80;
        setScale(Math.max(0.6, Math.min(2.2, avail / vp.width)));
        setPdf(doc);
        const pending = app.get().pendingPage;
        app.set({ pendingPage: null });
        const start = pending ?? (docRef.source === 'marginal' ? Math.max(saved.lastPage, docRef.paper.lastPage || 1) : saved.lastPage);
        setTimeout(() => goto(start, 'auto'), 60);
      } catch (e) {
        setError(String(e));
      }
    })();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docRef, docId]);

  const goto = (n: number, behavior: ScrollBehavior = 'smooth') => {
    const el = scroller.current?.querySelector<HTMLElement>(`.pdf-page[data-page="${n}"]`);
    if (el && scroller.current) scroller.current.scrollTo({ top: el.offsetTop - 24, behavior });
  };
  const pages = pdf?.numPages ?? 0;
  const turn = (dir: 1 | -1) => goto(Math.min(pages, Math.max(1, page + dir)));
  const zoom = (f: number) => {
    const sc = scroller.current;
    const ratio = sc ? sc.scrollTop / Math.max(1, sc.scrollHeight) : 0;
    setScale(s => Math.min(4, Math.max(0.4, s * f)));
    requestAnimationFrame(() => sc && (sc.scrollTop = ratio * sc.scrollHeight));
  };
  const bookmark = () => {
    update(n => ({ ...n, bookmarks: n.bookmarks.includes(page) ? n.bookmarks.filter(b => b !== page) : [...n.bookmarks, page].sort((a, b) => a - b) }));
    toast(notes.bookmarks.includes(page) ? 'Bookmark removed' : `Page ${faNum.format(page)} bookmarked`, 'ok');
  };
  const highlightSelection = () => {
    const sel = getSelection();
    if (!sel || sel.isCollapsed) return toast('Select some text first', 'warn');
    const range = sel.getRangeAt(0);
    const pageEl = (range.startContainer.parentElement ?? null)?.closest<HTMLElement>('.pdf-page');
    if (!pageEl) return;
    const pr = pageEl.getBoundingClientRect();
    const rects = [...range.getClientRects()].filter(r => r.width > 1).map(r => [(r.left - pr.left) / pr.width, (r.top - pr.top) / pr.height, r.width / pr.width, r.height / pr.height] as NRect);
    const text = sel.toString(); // read before clearing: the updater below runs later
    const pg = Number(pageEl.dataset.page);
    update(n => ({ ...n, highlights: [...n.highlights, { id: uid(), page: pg, rects: mergeLineRects(rects), color, text, created: new Date().toISOString() }] }));
    sel.removeAllRanges();
  };
  const source = (pg: number, rect?: [number, number, number, number]): Source => ({
    kind: 'pdf',
    docId,
    paperId: docRef?.source === 'marginal' ? docRef.paper.id : undefined,
    title: docRef?.source === 'marginal' ? docRef.paper.title : docRef?.source === 'file' ? docRef.name : '',
    page: pg,
    rect,
  });

  /** Clip-to-Canvas for text (SR-02): the selection becomes a highlight and a linked board card. */
  const clipSelection = () => {
    const sel = getSelection();
    if (!sel || sel.isCollapsed) return toast('Select some text first', 'warn');
    const range = sel.getRangeAt(0);
    const pageEl = range.startContainer.parentElement?.closest<HTMLElement>('.pdf-page');
    if (!pageEl) return;
    const pr = pageEl.getBoundingClientRect();
    const rects = [...range.getClientRects()].filter(r => r.width > 1).map(r => [(r.left - pr.left) / pr.width, (r.top - pr.top) / pr.height, r.width / pr.width, r.height / pr.height] as NRect);
    const merged = mergeLineRects(rects);
    const text = sel.toString().trim();
    const pg = Number(pageEl.dataset.page);
    const x0 = Math.min(...merged.map(r => r[0])), y0 = Math.min(...merged.map(r => r[1]));
    const x1 = Math.max(...merged.map(r => r[0] + r[2])), y1 = Math.max(...merged.map(r => r[1] + r[3]));
    update(n => ({ ...n, highlights: [...n.highlights, { id: uid(), page: pg, rects: merged, color: '#7cc8ff', text, created: new Date().toISOString() }] }));
    clipText(text, source(pg, [x0, y0, x1 - x0, y1 - y0]));
    sel.removeAllRanges();
  };

  /** Clip-to-Canvas for figures: crop the drawn region from the rendered page. */
  const clipRegion = (pageEl: HTMLElement, pg: number, a: [number, number], b: [number, number]) => {
    const canvas = pageEl.querySelector('canvas');
    if (!canvas) return;
    const x0 = Math.max(0, Math.min(a[0], b[0])), y0 = Math.max(0, Math.min(a[1], b[1]));
    const w = Math.min(1, Math.max(a[0], b[0])) - x0, h = Math.min(1, Math.max(a[1], b[1])) - y0;
    if (w < 0.02 || h < 0.02) return toast('The area is too small', 'warn');
    const img = cropToDataUrl(canvas, x0 * canvas.width, y0 * canvas.height, w * canvas.width, h * canvas.height);
    clipFigure(img, source(pg, [x0, y0, w, h]));
  };

  /** The page in view right now, read from the scroll position (state can lag just after loading). */
  const visiblePage = () => {
    const sc = scroller.current;
    if (!sc) return page;
    const top = sc.scrollTop + sc.clientHeight * 0.35;
    let cur = 1;
    for (const el of sc.querySelectorAll<HTMLElement>('.pdf-page')) if (el.offsetTop <= top) cur = Number(el.dataset.page);
    return cur;
  };

  const pageText = async (n: number) => {
    if (!pdf) return '';
    const tc = await (await pdf.getPage(n)).getTextContent();
    return tc.items.map(it => ('str' in it ? it.str : '')).join(' ').replace(/\s+/g, ' ');
  };

  /** Ask the local AI about the selection, or about the current page when nothing is selected. */
  const askAI = async (action?: Action) => {
    const sel = getSelection();
    const text = sel && !sel.isCollapsed ? sel.toString().trim() : '';
    const pageEl = text ? sel!.getRangeAt(0).startContainer.parentElement?.closest<HTMLElement>('.pdf-page') : null;
    const pg = pageEl ? Number(pageEl.dataset.page) : visiblePage();
    const context = await pageText(pg);
    openAssistant({ excerpt: text || context.slice(0, 3500), context: text ? context : undefined, source: source(pg) }, action ?? (text ? 'explain' : 'summarize'), !!action);
  };

  // undo removes the most recent mark, highlight or stroke, whichever came last
  const undo = () =>
    update(n => {
      const lh = n.highlights[n.highlights.length - 1];
      const ls = n.strokes[n.strokes.length - 1];
      const lastIsStroke = ls && (!lh || (ls.created ?? '') > lh.created);
      if (lastIsStroke) return { ...n, strokes: n.strokes.slice(0, -1) };
      return lh ? { ...n, highlights: n.highlights.slice(0, -1) } : n;
    });

  // track the current page while scrolling and remember it
  useEffect(() => {
    const sc = scroller.current;
    if (!sc || !pdf) return;
    const onScroll = () => {
      const top = sc.scrollTop + sc.clientHeight * 0.35;
      let cur = 1;
      for (const el of sc.querySelectorAll<HTMLElement>('.pdf-page')) if (el.offsetTop <= top) cur = Number(el.dataset.page);
      setPage(p => (p === cur ? p : cur));
    };
    sc.addEventListener('scroll', onScroll, { passive: true });
    return () => sc.removeEventListener('scroll', onScroll);
  }, [pdf]);
  useEffect(() => {
    if (pdf && page !== notes.lastPage) update(n => ({ ...n, lastPage: page }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // imperative controls for voice / command bar
  useEffect(() => {
    controls.current = { page: turn, gotoPage: n => goto(n), zoom: d => zoom(d > 0 ? 1.15 : 1 / 1.15), bookmark, ask: a => void askAI(a as Action) };
    return () => {
      controls.current = {};
    };
  });

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
      if (e.key === 'j' || e.key === 'PageDown') turn(1);
      else if (e.key === 'k' || e.key === 'PageUp') turn(-1);
      else if (e.key === 'b') bookmark();
      else if (e.key === 'h') highlightSelection();
      else if (e.key === 'c') clipSelection();
      else if (e.key === 'a') void askAI();
      else if (e.key === 'f') app.set({ focus: !app.get().focus });
      else if (e.key === 'l') setLens(v => !v);
      else if (e.key === '+' || e.key === '=') zoom(1.15);
      else if (e.key === '-') zoom(1 / 1.15);
      else if (e.ctrlKey && e.key === 'z') undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // gestures in reading context
  useVisionHandler(
    (e, px) => {
      switch (e.type) {
        case 'SWIPE':
          if (e.dir === 'left') turn(1);
          else if (e.dir === 'right') turn(-1);
          return true;
        case 'ZOOM':
          zoom(e.scale);
          return true;
        case 'POINTER_MOVE':
          if (lens && px) setLensAt(px);
          return false;
        case 'DRAG_START': {
          if (tool === 'select' || !px) return false;
          const hit = pageAt(px);
          if (!hit) return false;
          setSelRect({ n: hit.n, a: [hit.nx, hit.ny], b: [hit.nx, hit.ny] });
          return true;
        }
        case 'DRAG_MOVE': {
          if (!selRect || !px) return false;
          const el = scroller.current?.querySelector<HTMLElement>(`.pdf-page[data-page="${selRect.n}"]`);
          if (!el) return true;
          const r = el.getBoundingClientRect();
          const b: [number, number] = [(px.x - r.left) / r.width, (px.y - r.top) / r.height];
          setSelRect(s => (s ? { ...s, b, ...(tool === 'pen' ? { pts: [...((s as { pts?: [number, number][] }).pts ?? [s.a]), b] } : {}) } : s));
          return true;
        }
        case 'DRAG_END': {
          if (!selRect) return false;
          const el = scroller.current?.querySelector<HTMLElement>(`.pdf-page[data-page="${selRect.n}"]`);
          if (el && tool === 'highlight') {
            const { rects, text } = snapToText(el, selRect.a, selRect.b);
            update(n => ({ ...n, highlights: [...n.highlights, { id: uid(), page: selRect.n, rects, color, text, created: new Date().toISOString() }] }));
          } else if (el && tool === 'clip') {
            clipRegion(el, selRect.n, selRect.a, selRect.b);
          } else if (tool === 'pen') {
            const pts = (selRect as { pts?: [number, number][] }).pts ?? [selRect.a, selRect.b];
            update(n => ({ ...n, strokes: [...n.strokes, { id: uid(), page: selRect.n, pts, color: '#c0392b', width: 0.003, created: new Date().toISOString() }] }));
          }
          setSelRect(null);
          return true;
        }
      }
      return false;
    },
    [lens, tool, selRect, color, page, pages],
  );

  useRadialItems(
    [
      { id: 'hl', label: 'Highlight', icon: 'highlight', run: () => setTool(t => (t === 'highlight' ? 'select' : 'highlight')) },
      { id: 'pen', label: 'Pen', icon: 'pen', run: () => setTool(t => (t === 'pen' ? 'select' : 'pen')) },
      { id: 'clip', label: 'Clip figure', icon: 'scissors', run: () => setTool(t => (t === 'clip' ? 'select' : 'clip')) },
      { id: 'cliptext', label: 'Clip text', icon: 'board', run: () => clipSelection() },
      { id: 'ai', label: 'AI', icon: 'sparkle', run: () => void askAI() },
      { id: 'lens', label: 'Magnifier', icon: 'lens', run: () => setLens(v => !v) },
      { id: 'bm', label: 'Bookmark', icon: 'bookmark', run: bookmark },
      { id: 'focus', label: 'Focus', icon: 'focus', run: () => app.set({ focus: !app.get().focus }) },
      { id: 'undo', label: 'Undo', icon: 'undo', run: undo },
    ],
    [page, notes],
  );

  // precision lens: magnify the canvas region under the mouse / hand cursor
  useEffect(() => {
    if (!lens) return;
    const onMove = (e: MouseEvent) => setLensAt({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', onMove);
    setLensAt(cursorPx);
    return () => window.removeEventListener('mousemove', onMove);
  }, [lens]);
  useEffect(() => {
    if (!lens || !lensAt || !lensCanvas.current) return;
    const hit = pageAt(lensAt);
    const ctx = lensCanvas.current.getContext('2d')!;
    ctx.fillStyle = '#fffdf7';
    ctx.fillRect(0, 0, 260, 260);
    if (!hit) return;
    const src = hit.el.querySelector('canvas')!;
    const zoomK = 2.6;
    const sw = (260 / zoomK) * (src.width / hit.el.clientWidth);
    const sx = hit.nx * src.width - sw / 2, sy = hit.ny * src.height - sw / 2;
    ctx.drawImage(src, sx, sy, sw, sw, 0, 0, 260, 260);
  }, [lens, lensAt, scale]);

  const openFile = async (f: File | undefined) => {
    if (!f) return;
    app.set({ doc: { source: 'file', name: f.name, data: await f.arrayBuffer() } });
  };

  if (!docRef) {
    return (
      <div className="reader-empty">
        <div className="card empty-card">
          <Icon name="book" size={40} />
          <h2>Open a PDF to read</h2>
          <p className="muted">From the “Continue reading” card in the garden, or a file on this computer.</p>
          <label className="btn primary big">
            <Icon name="file" /> Choose a PDF file
            <input type="file" accept="application/pdf" hidden onChange={e => openFile(e.target.files?.[0])} />
          </label>
        </div>
      </div>
    );
  }

  const title = docRef.source === 'marginal' ? docRef.paper.title : docRef.name;
  return (
    <div className={`reader ${focus ? 'focus' : ''} tool-${tool}`}>
      <div className="reader-bar">
        <div className="reader-title" dir="auto" title={title}>
          {title}
        </div>
        <div className="seg">
          <button className="ibtn" onClick={() => turn(-1)} title="Previous page (K)">
            <Icon name="left" />
          </button>
          <span className="page-ind">
            {faNum.format(page)} / {faNum.format(pages)}
          </span>
          <button className="ibtn" onClick={() => turn(1)} title="Next page (J)">
            <Icon name="right" />
          </button>
        </div>
        <div className="seg">
          <button className="ibtn" onClick={() => zoom(1 / 1.15)} title="Zoom out">
            <Icon name="minus" />
          </button>
          <span className="page-ind">{faNum.format(Math.round(scale * 100))}%</span>
          <button className="ibtn" onClick={() => zoom(1.15)} title="Zoom in">
            <Icon name="plus" />
          </button>
        </div>
        <div className="seg">
          <button className={`ibtn ${tool === 'highlight' ? 'on' : ''}`} onClick={() => setTool(tool === 'highlight' ? 'select' : 'highlight')} title="Highlight (drag over text, or H for the selected text)">
            <Icon name="highlight" />
          </button>
          {tool === 'highlight' &&
            HL_COLORS.map(c => (
              <button key={c} className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label="Color" />
            ))}
          <button className="ibtn" onClick={() => void askAI()} title="Ask the AI about the selected text or this page (A)">
            <Icon name="sparkle" />
          </button>
          <button className="ibtn" onClick={clipSelection} title="Clip the selected text to the board (C)">
            <Icon name="board" />
          </button>
          <button className={`ibtn ${tool === 'clip' ? 'on' : ''}`} onClick={() => setTool(tool === 'clip' ? 'select' : 'clip')} title="Clip a figure or chart to the board (draw around it)">
            <Icon name="scissors" />
          </button>
          <button className={`ibtn ${split ? 'on' : ''}`} onClick={() => app.set({ split: !split })} title="Split view: PDF + knowledge board">
            <Icon name="split" />
          </button>
          <button className={`ibtn ${tool === 'pen' ? 'on' : ''}`} onClick={() => setTool(tool === 'pen' ? 'select' : 'pen')} title="Pen">
            <Icon name="pen" />
          </button>
          <button className={`ibtn ${lens ? 'on' : ''}`} onClick={() => setLens(!lens)} title="Precision magnifier (L)">
            <Icon name="lens" />
          </button>
          <button className={`ibtn ${notes.bookmarks.includes(page) ? 'on' : ''}`} onClick={bookmark} title="Bookmark (B)">
            <Icon name="bookmark" />
          </button>
          <button className="ibtn" onClick={undo} title="Undo (Ctrl+Z)">
            <Icon name="undo" />
          </button>
          <button className={`ibtn ${focus ? 'on' : ''}`} onClick={() => app.set({ focus: !focus })} title="Focus mode (F)">
            <Icon name="focus" />
          </button>
          <label className="ibtn" title="Open another file">
            <Icon name="file" />
            <input type="file" accept="application/pdf" hidden onChange={e => openFile(e.target.files?.[0])} />
          </label>
        </div>
      </div>

      <div className="reader-body">
        {!focus && !split && (
          <aside className="reader-side">
            <h4>Bookmarks</h4>
            {notes.bookmarks.length === 0 && <p className="muted small">No bookmarks yet</p>}
            {notes.bookmarks.map(b => (
              <button key={b} className="side-row" onClick={() => goto(b)}>
                <Icon name="bookmark" size={16} /> Page {faNum.format(b)}
              </button>
            ))}
            <h4>Highlights</h4>
            {notes.highlights.length === 0 && <p className="muted small">Select text and press H, or drag over text with a pinch</p>}
            {notes.highlights
              .slice()
              .reverse()
              .map(h => (
                <button key={h.id} className="side-row hl-row" onClick={() => goto(h.page)}>
                  <span className="hl-chip" style={{ background: h.color }} />
                  <span dir="auto" className="hl-text">
                    {h.text || '—'}
                  </span>
                  <span className="muted small">p. {faNum.format(h.page)}</span>
                </button>
              ))}
          </aside>
        )}
        <div className="pdf-scroll" ref={scroller}>
          {error && <div className="card">Could not open the PDF: {error}</div>}
          {!pdf && !error && <div className="loading-leaf">Opening…</div>}
          {pdf &&
            Array.from({ length: pdf.numPages }, (_, i) => (
              <PageView
                key={i}
                doc={pdf}
                n={i + 1}
                scale={scale}
                baseSize={baseSize}
                notes={notes}
                tool={tool}
                onDrawStroke={(pg, pts) => update(n => ({ ...n, strokes: [...n.strokes, { id: uid(), page: pg, pts, color: '#c0392b', width: 0.003, created: new Date().toISOString() }] }))}
                onClip={clipRegion}
              />
            ))}
          {selRect && (tool === 'highlight' || tool === 'clip') && <SelectionBox sel={selRect} />}
        </div>
        {split && (
          <aside className="reader-split">
            <Board compact />
          </aside>
        )}
      </div>
      {lens && lensAt && <canvas ref={lensCanvas} width={260} height={260} className="lens" style={{ left: lensAt.x - 130, top: lensAt.y - 290 }} />}
    </div>
  );
}

function SelectionBox({ sel }: { sel: { n: number; a: [number, number]; b: [number, number] } }) {
  const el = document.querySelector<HTMLElement>(`.pdf-page[data-page="${sel.n}"]`);
  if (!el) return null;
  const x0 = Math.min(sel.a[0], sel.b[0]), y0 = Math.min(sel.a[1], sel.b[1]);
  return (
    <div
      className="sel-box"
      style={{
        left: el.offsetLeft + x0 * el.clientWidth,
        top: el.offsetTop + y0 * el.clientHeight,
        width: Math.abs(sel.a[0] - sel.b[0]) * el.clientWidth,
        height: Math.abs(sel.a[1] - sel.b[1]) * el.clientHeight,
      }}
    />
  );
}
