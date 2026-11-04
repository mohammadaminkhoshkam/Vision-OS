// Garden Home: built around the work in progress, not the clock. The left column answers
// «what am I doing and what is the best next step?» (session hero), with a quiet status strip
// above it; the right column holds secondary context (recent work, time today, habits). The
// lit planter with «Library» stays in the centre of the scene.
import { useEffect, useMemo, useState } from 'react';
import { appData } from '../apps/data';
import { describe, refreshWeather, weather } from '../apps/weather';
import { board } from '../board/store';
import { remainingSec, stats } from '../focus/engine';
import { current, focus, start, todayKey, useNow } from '../focus/store';
import { GardenStudio, InspectCard, PaperActions } from '../garden/GardenStudio';
import { garden } from '../garden/gardenState';
import { paperProgress } from '../garden/KnowledgeGarden';
import { platform } from '../platform';
import { loadNotes } from '../reader/annotations';
import { app, go, openPaper, openVideo, toast } from '../state/app';
import { describeActivity, nextAction, relativeTime, workspace, type Activity } from '../state/workspace';
import { Icon, type IconName } from '../ui/icons';
import { useVisionHandler } from '../vision/router';

const fa = new Intl.NumberFormat('en-US');
const faTime = (min: number) => `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')}`;

function useClock(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Quiet status strip: greeting, time and date in one line; the work gets the big type. */
function StatusStrip() {
  const now = useClock(10000);
  const h = now.getHours();
  const night = h < 5 || h >= 19;
  const name = app.use(s => s.userName);
  const greet = h < 5 ? 'Good night' : h < 11 ? 'Good morning' : h < 16 ? 'Good afternoon' : h < 19 ? 'Good evening' : 'Good night';
  return (
    <div className="status-strip">
      <span className="ss-greet">
        <Icon name={night ? 'moon' : 'sun'} size={18} />
        {greet}
        {name ? `, ${name}` : ''}
      </span>
      <span className="ss-time">{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
      <span className="ss-date">{now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
      <WeatherPill />
    </div>
  );
}

/** Reopen an activity exactly where it was left. */
export function resumeActivity(a: Activity, opts: { split?: boolean } = {}) {
  if (a.kind === 'video') return openVideo(a.id, a.t ?? 0);
  const doc = app.get().doc;
  if (a.kind === 'paper') {
    const paper = appData.get().papers.find(p => p.id === a.id) ?? (doc?.source === 'marginal' && doc.paper.id === a.id ? doc.paper : null);
    if (!paper) return toast('That paper is no longer in the Marginal library', 'warn');
    openPaper(paper, a.page);
  } else {
    // a local PDF lives only in memory; after a restart it has to be picked again
    const same = doc?.source === 'file' && `f-${doc.name}-${doc.data.byteLength}` === a.id;
    if (!same) toast('Open the file again to continue; your highlights are kept', 'info');
    go('reader');
  }
  app.set({ split: !!opts.split });
}

function useActivityStats(a: Activity | null) {
  const nodes = board.use(s => s.doc.nodes);
  return useMemo(() => {
    if (!a || a.kind === 'video') return { notes: 0, cards: a ? nodes.filter(n => n.source?.kind === 'video' && n.source.videoId === a.id).length : 0 };
    const docId = a.kind === 'paper' ? `m-${a.id}` : a.id;
    const n = loadNotes(docId);
    const cards = nodes.filter(x => x.source?.kind === 'pdf' && (x.source.docId === docId || (a.kind === 'paper' && x.source.paperId === a.id))).length;
    return { notes: n.highlights.length + n.bookmarks.length, cards };
  }, [a, nodes]);
}

const plural = (n: number, w: string) => `${fa.format(n)} ${w}${n === 1 ? '' : 's'}`;

/** The heart of Home: the current session and the single best next step. */
function SessionHero() {
  const recent = workspace.use(s => s.recent);
  const { tasks, defaultMinutes } = focus.use(s => s);
  focus.use(s => s.sessions);
  const now = useNow(15000);
  const last = recent[0] ?? null;
  const running = current();
  const today = todayKey(new Date(now));
  const next = nextAction({
    last,
    focus: running ? { title: running.link?.title ?? running.tag, remainingSec: running.mode === 'pomodoro' ? remainingSec(running, now) : null } : null,
    tasks: tasks.filter(t => !t.day || t.day === today),
    now: new Date(now),
  });
  const st = useActivityStats(last);
  const prog = last?.pages && last.page ? Math.min(1, last.page / last.pages) : 0;

  const heading = { focus: 'You’re in a focus session', task: 'Coming up next', resume: 'Continue where you left off', start: 'Start your session' }[next.kind];
  const focusOn = (a: Activity) => {
    start('pomodoro', defaultMinutes, 'Reading', { kind: a.kind === 'video' ? 'video' : 'paper', id: a.id, title: a.title });
    resumeActivity(a);
  };

  return (
    <section className={`session-hero kind-${next.kind}`} aria-labelledby="sh-title">
      <div className="sh-eyebrow">
        <span className="sh-live" aria-hidden />
        Your current session
      </div>
      <h2 id="sh-title">{heading}</h2>

      {next.kind !== 'resume' && next.kind !== 'start' && (
        <div className="sh-next">
          <Icon name={next.kind === 'focus' ? 'timer' : 'calendar'} size={18} />
          {/* a focus session on the paper below needs no second title */}
          {!(next.kind === 'focus' && running?.link?.id === last?.id) && <span dir="auto">{next.title}</span>}
          <small>{next.detail}</small>
        </div>
      )}

      {last ? (
        <div className="sh-work">
          <div className="sh-work-head">
            <span className="sh-kind">
              <Icon name={last.kind === 'video' ? 'youtube' : 'file'} size={22} />
            </span>
            <div className="sh-work-text">
              <div className="sh-title" dir="auto">
                {last.title}
              </div>
              <div className="sh-meta">
                {describeActivity(last)}
                {st.notes > 0 && <> · {plural(st.notes, 'saved note')}</>}
                {st.cards > 0 && <> · {plural(st.cards, 'board card')}</>}
                <> · {relativeTime(last.at, now)}</>
              </div>
            </div>
          </div>
          {last.kind !== 'video' && last.pages ? (
            <div className="sh-progress" aria-label={`${Math.round(prog * 100)}% read`}>
              <span style={{ width: `${Math.round(prog * 100)}%` }} />
            </div>
          ) : null}
          <div className="sh-actions">
            {next.kind === 'focus' && running?.link && running.link.id !== last.id ? null : (
              <button className="sh-btn primary" onClick={() => resumeActivity(last)}>
                <Icon name={last.kind === 'video' ? 'play' : 'book'} size={18} />
                {last.kind === 'video' ? 'Resume video' : 'Resume reading'}
              </button>
            )}
            {last.kind !== 'video' && (
              <button className="sh-btn" onClick={() => resumeActivity(last, { split: true })} title="Paper and knowledge board side by side">
                <Icon name="split" size={18} />
                With board
              </button>
            )}
            {!running && (
              <button className="sh-btn" onClick={() => focusOn(last)} title={`Start a ${defaultMinutes}-minute focus session on this`}>
                <Icon name="timer" size={18} />
                Focus {fa.format(defaultMinutes)} min
              </button>
            )}
            {next.kind === 'focus' && (
              <button className="sh-btn" onClick={() => go('focus')}>
                <Icon name="timer" size={18} />
                Focus studio
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="sh-work empty">
          <p className="sh-meta">Nothing in progress yet. Open a paper and Vision OS will keep your place, your notes and your board together.</p>
          <div className="sh-actions">
            <button className="sh-btn primary" onClick={() => go('library')}>
              <Icon name="folder" size={18} />
              Open the library
            </button>
            <button className="sh-btn" onClick={() => go('reader')}>
              <Icon name="file" size={18} />
              Open a PDF
            </button>
            <button className="sh-btn" onClick={() => go('focus')}>
              <Icon name="timer" size={18} />
              Focus session
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function WeatherPill() {
  const { city, weather: w, error } = weather.use(s => s);
  useEffect(() => {
    void refreshWeather();
    const t = setInterval(() => void refreshWeather(), 30 * 60000);
    return () => clearInterval(t);
  }, []);
  if (!w) return error ? null : <div className="weather-pill muted">…</div>;
  const d = describe(w.code);
  const icon: IconName = d.icon === 'sun' && !w.isDay ? 'moon' : d.icon;
  return (
    <div className="weather-pill" title={d.label}>
      <span className="wp-city">
        <Icon name="pin" size={18} /> {city.name}
      </span>
      <span className="wp-temp" dir="ltr">
        {fa.format(w.temp)}°C
      </span>
      <span className={`wp-icon ${icon}`}>
        <Icon name={icon} size={26} />
      </span>
    </div>
  );
}

function QuickNav() {
  const items: { label: string; icon: IconName; run: () => void; primary?: boolean }[] = [
    { label: 'Read', icon: 'book', run: () => go('reader'), primary: true },
    { label: 'Research', icon: 'network', run: () => go('board') },
    { label: 'Schedule', icon: 'calendar', run: () => (app.set({ plannerTab: 'schedule' }), go('planner')) },
    { label: 'Notes', icon: 'file', run: () => (app.set({ libraryTab: 'notes' }), go('library')) },
  ];
  return (
    <div className="quick-nav">
      {items.map(i => (
        <button key={i.label} className={`qn ${i.primary ? 'on' : ''}`} onClick={i.run}>
          <Icon name={i.icon} size={18} />
          <span>{i.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Other work in progress (the current item is already in the hero). */
function RecentCard() {
  const recent = workspace.use(s => s.recent);
  const { papers, marginal, loaded } = appData.use(s => s);
  const now = Date.now();
  const others = recent.slice(1, 4);
  // with no history yet, suggest papers that are part-way through
  const suggestions = others.length ? [] : papers.filter(p => paperProgress(p) > 0 && paperProgress(p) < 1).slice(0, 3);
  return (
    <section className="card hcard">
      <header className="card-h">
        <Icon name="book" />
        <h3>{others.length ? 'Also in progress' : 'Pick up a paper'}</h3>
      </header>
      {!loaded && !others.length && <p className="muted">Reading the library…</p>}
      {loaded && !others.length && !suggestions.length && (
        <button className="hc-empty" onClick={() => go('library')}>
          {marginal ? 'Browse the library' : 'No Marginal data found; open the library'}
        </button>
      )}
      <ul className="recent-list">
        {others.map(a => (
          <li key={`${a.kind}-${a.id}`}>
            <button className="recent-row" onClick={() => resumeActivity(a)}>
              <Icon name={a.kind === 'video' ? 'youtube' : 'file'} size={18} />
              <span className="rr-text">
                <span className="paper-title" dir="auto">
                  {a.title}
                </span>
                <span className="paper-meta">
                  {describeActivity(a)} · {relativeTime(a.at, now)}
                </span>
              </span>
            </button>
          </li>
        ))}
        {suggestions.map(p => (
          <li key={p.id}>
            <button className="recent-row" onClick={() => openPaper(p)} disabled={!p.pdf}>
              <Icon name="file" size={18} />
              <span className="rr-text">
                <span className="paper-title" dir="auto">
                  {p.title}
                </span>
                <span className="paper-meta">
                  Page {fa.format(p.lastPage || 1)} · {fa.format(Math.round(paperProgress(p) * 100))}% read
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TimeCard() {
  const rooz = appData.use(s => s.rooz);
  const { sessions, tasks } = focus.use(s => s);
  const now = useClock(30000);
  const focusMin = stats(sessions, now.getTime()).todayMin;
  const minutes = Math.max(rooz?.available ? rooz.todayMinutes : 0, focusMin);
  const goal = rooz?.available ? rooz.goalMinutes : 240;
  const pct = Math.min(1, minutes / Math.max(1, goal));
  const C = 2 * Math.PI * 30;
  const today = todayKey(now);
  const schedule = tasks
    .filter(t => t.time && (!t.day || t.day === today))
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
    .slice(0, 3);
  return (
    <section className="card hcard">
      <header className="card-h">
        <Icon name="clock" />
        <h3>Time today</h3>
      </header>
      <div className="hc-inner">
        <div className="time-row">
          <div>
            <div className="time-big">{faTime(minutes)}</div>
            <div className="muted small">{now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
          <svg width="76" height="76" viewBox="0 0 76 76" className="ring" aria-label={`${Math.round(pct * 100)}%`}>
            <circle cx="38" cy="38" r="30" className="ring-bg" />
            <circle cx="38" cy="38" r="30" className="ring-fg" strokeDasharray={`${C * pct} ${C}`} transform="rotate(-90 38 38)" />
          </svg>
        </div>
        <ul className="sched">
          {schedule.length === 0 && (
            <li className="muted small">
              <button className="link" onClick={() => (app.set({ plannerTab: 'schedule' }), go('planner'))}>
                Nothing scheduled for today; add something
              </button>
            </li>
          )}
          {schedule.map(t => (
            <li key={t.id} className={t.done ? 'done' : ''}>
              <span className={`sched-dot ${t.done ? 'ok' : t.priority === 'high' ? 'hi' : 'mid'}`} />
              <span dir="auto">{t.title}</span>
              <span className="sched-time">{t.time}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function HabitsCard() {
  const { habits, habitwall } = appData.use(s => s);
  if (!habitwall) return null;
  const open = () =>
    void platform
      .launch('habitwall')
      .then(() => toast('Habits are checked off in HabitWall', 'info'))
      .catch(() => toast('HabitWall not found', 'warn'));
  return (
    <section className="card hcard">
      <header className="card-h">
        <Icon name="leaf" />
        <h3>Today’s habits</h3>
      </header>
      <ul className="hc-inner habits">
        {habits.length === 0 && <li className="muted small">No habits created in HabitWall yet.</li>}
        {habits.slice(0, 5).map(h => (
          <li key={h.id}>
            <button className={`hcheck ${h.done ? 'on' : ''}`} onClick={open} aria-label={h.done ? 'Done' : 'Check off in HabitWall'} title="Check off in HabitWall">
              {h.done && <Icon name="check" size={14} stroke={3} />}
            </button>
            <span dir="auto">{h.title}</span>
            {h.unit && <span className="muted small">({fa.format(h.target)} {h.unit})</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function FlowerCard() {
  const hover = garden.use(s => s.hover);
  if (!hover) return null;
  const { paper, rect } = hover;
  const prog = paperProgress(paper);
  const left = Math.min(innerWidth - 300, Math.max(12, rect.left + rect.width / 2 - 140));
  const top = Math.max(12, rect.top - 150);
  return (
    <div className="flower-card" style={{ left, top }}>
      <div className="paper-title" dir="auto">
        {paper.title}
      </div>
      <div className="paper-meta" dir="auto">
        {paper.authors} · {paper.venue} {paper.year}
      </div>
      <div className="muted small">
        Progress {fa.format(Math.round(prog * 100))}% · {fa.format(paper.notes)} notes · pinch or click for options
      </div>
    </div>
  );
}

export function Home() {
  useVisionHandler(
    (e, px) => {
      if (e.type !== 'POINTER_MOVE' || !px) return false;
      const el = document.elementFromPoint(px.x, px.y)?.closest('.kflower');
      const cur = garden.get().hover;
      if (el) {
        const title = el.getAttribute('aria-label');
        const paper = appData.get().papers.find(p => p.title === title);
        if (paper && cur?.paper.id !== paper.id) garden.set({ hover: { paper, rect: el.getBoundingClientRect() } });
      } else if (cur) garden.set({ hover: null });
      return false;
    },
    [],
  );

  return (
    <div className="home">
      <div className="home-left">
        <StatusStrip />
        <SessionHero />
        <QuickNav />
        <GardenStudio />
      </div>
      <div className="home-cards">
        <RecentCard />
        <TimeCard />
        <HabitsCard />
      </div>
      <FlowerCard />
      <InspectCard />
      <PaperActions />
    </div>
  );
}
