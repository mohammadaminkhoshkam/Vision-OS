// Library: every paper from Marginal (open at the last page, with the board, or with a focus
// timer), opening a local PDF, and one list of all highlights, bookmarks and board notes.
import { useMemo, useState } from 'react';
import { appData } from '../apps/data';
import { board } from '../board/store';
import { focusOnPaper } from '../focus/FocusUI';
import { paperProgress } from '../garden/KnowledgeGarden';
import { loadNotes } from '../reader/annotations';
import { app, go, openPaper, type LibraryTab } from '../state/app';
import { Icon } from '../ui/icons';

const fa = new Intl.NumberFormat('en-US');
const STATUS: Record<string, string> = { reading: 'Reading', toread: 'To read', 'to-read': 'To read', read: 'Read', done: 'Read', dropped: 'Set aside', reviewed: 'Reviewed', implemented: 'Implemented' };

function Papers() {
  const papers = appData.use(s => s.papers);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'recent' | 'title' | 'progress'>('recent');
  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    const f = papers.filter(p => !k || `${p.title} ${p.authors} ${p.venue} ${p.year}`.toLowerCase().includes(k));
    if (sort === 'title') return [...f].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'progress') return [...f].sort((a, b) => paperProgress(b) - paperProgress(a));
    return f;
  }, [papers, q, sort]);
  const openFile = async (file: File | undefined) => {
    if (!file) return;
    app.set({ doc: { source: 'file', name: file.name, data: await file.arrayBuffer() }, screen: 'reader' });
  };
  return (
    <>
      <div className="lib-tools">
        <div className="lib-search">
          <Icon name="search" size={18} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search titles, authors, venues…" />
        </div>
        {(['recent', 'title', 'progress'] as const).map(s => (
          <button key={s} className={`chip ${sort === s ? 'on' : ''}`} onClick={() => setSort(s)}>
            {s === 'recent' ? 'Recent' : s === 'title' ? 'Title' : 'Progress'}
          </button>
        ))}
        <label className="btn primary">
          <Icon name="file" size={18} /> Open a PDF from this computer
          <input type="file" accept="application/pdf" hidden onChange={e => void openFile(e.target.files?.[0])} />
        </label>
      </div>
      {list.length === 0 && <p className="muted lib-empty">{papers.length ? 'Nothing found.' : 'The Marginal library is empty or was not found. Open a PDF from this computer.'}</p>}
      <div className="lib-grid">
        {list.map(p => {
          const prog = paperProgress(p);
          return (
            <article key={p.id} className="lib-card">
              <div className="lib-thumb">
                <Icon name="file" size={30} />
                {p.favorite && <span className="lib-fav">★</span>}
              </div>
              <div className="lib-body">
                <h4 dir="auto">{p.title}</h4>
                <p className="paper-meta" dir="auto">
                  {p.authors} · {p.venue} {p.year}
                </p>
                <div className="lib-meta">
                  <span className="lib-status">{STATUS[p.status] ?? p.status}</span>
                  <span>
                    p. {fa.format(p.lastPage || 1)}/{fa.format(p.pages || 0)}
                  </span>
                  <span>{fa.format(p.notes)} notes</span>
                </div>
                <span className="bar">
                  <span style={{ width: `${Math.round(prog * 100)}%` }} />
                </span>
                <div className="lib-actions">
                  <button className="btn small primary" onClick={() => openPaper(p)} disabled={!p.pdf}>
                    <Icon name="book" size={16} /> Continue reading
                  </button>
                  <button className="btn small" onClick={() => (app.set({ split: true }), openPaper(p))} disabled={!p.pdf}>
                    <Icon name="split" size={16} /> With the board
                  </button>
                  <button className="btn small" onClick={() => (focusOnPaper({ kind: 'paper', id: p.id, title: p.title }), openPaper(p))} disabled={!p.pdf}>
                    <Icon name="timer" size={16} /> With the timer
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

interface NoteRow {
  key: string;
  kind: 'highlight' | 'bookmark' | 'board';
  text: string;
  color?: string;
  page?: number;
  docTitle: string;
  paperId?: string;
  at: string;
}

function collectNotes(): NoteRow[] {
  const papers = appData.get().papers;
  const rows: NoteRow[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith('vos.notes.')) continue;
    const docId = k.slice('vos.notes.'.length);
    const paper = docId.startsWith('m-') ? papers.find(p => `m-${p.id}` === docId) : undefined;
    const title = paper?.title ?? docId.replace(/^f-/, '').replace(/-\d+$/, '');
    const n = loadNotes(docId);
    for (const h of n.highlights) rows.push({ key: `${k}-${h.id}`, kind: 'highlight', text: h.text || '—', color: h.color, page: h.page, docTitle: title, paperId: paper?.id, at: h.created });
    for (const b of n.bookmarks) rows.push({ key: `${k}-b${b}`, kind: 'bookmark', text: `Bookmark on page ${fa.format(b)}`, page: b, docTitle: title, paperId: paper?.id, at: '' });
  }
  for (const node of board.get().doc.nodes)
    if (node.type === 'note' || node.type === 'ai')
      rows.push({ key: `board-${node.id}`, kind: 'board', text: node.text || '—', docTitle: node.source && 'title' in node.source ? node.source.title : 'Knowledge board', page: node.source?.kind === 'pdf' ? node.source.page : undefined, paperId: node.source?.kind === 'pdf' ? node.source.paperId : undefined, at: node.created });
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}

function Notes() {
  const papers = appData.use(s => s.papers);
  const rows = useMemo(collectNotes, [papers]);
  const [q, setQ] = useState('');
  const shown = rows.filter(r => !q.trim() || `${r.text} ${r.docTitle}`.toLowerCase().includes(q.trim().toLowerCase()));
  const open = (r: NoteRow) => {
    if (r.kind === 'board') return go('board');
    const p = papers.find(x => x.id === r.paperId);
    if (p) openPaper(p, r.page);
  };
  return (
    <>
      <div className="lib-tools">
        <div className="lib-search">
          <Icon name="search" size={18} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search highlights and notes…" />
        </div>
        <span className="muted small">{fa.format(shown.length)} items</span>
      </div>
      {shown.length === 0 && <p className="muted lib-empty">No highlights or notes yet. In the reader, select text and press H or C.</p>}
      <ul className="note-list">
        {shown.map(r => (
          <li key={r.key}>
            <button className="note-row" onClick={() => open(r)}>
              <span className="note-chip" style={{ background: r.color ?? (r.kind === 'board' ? '#b9a3e8' : '#d5a64f') }} />
              <span className="note-text" dir="auto">
                {r.text.length > 220 ? r.text.slice(0, 220) + '…' : r.text}
              </span>
              <span className="note-src" dir="auto">
                {r.docTitle.slice(0, 42)}
                {r.page ? ` · p. ${fa.format(r.page)}` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

export function Library() {
  const tab = app.use(s => s.libraryTab);
  const set = (t: LibraryTab) => app.set({ libraryTab: t });
  return (
    <div className="panel-screen">
      <header className="ps-head">
        <Icon name="folder" size={26} />
        <h2>Library</h2>
        <div className="ps-tabs">
          <button className={`chip ${tab === 'papers' ? 'on' : ''}`} onClick={() => set('papers')}>
            Papers
          </button>
          <button className={`chip ${tab === 'notes' ? 'on' : ''}`} onClick={() => set('notes')}>
            Notes and highlights
          </button>
        </div>
      </header>
      <div className="ps-body">{tab === 'papers' ? <Papers /> : <Notes />}</div>
    </div>
  );
}
