// Garden Home (reference layout): three glass cards on the left, greeting/clock/date/weather
// and quick navigation on the right, the lit planter with «Library» in the centre.
import { useEffect, useState } from 'react';
import { appData } from '../apps/data';
import { describe, refreshWeather, weather } from '../apps/weather';
import { stats } from '../focus/engine';
import { focus, todayKey } from '../focus/store';
import { GardenStudio, InspectCard, PaperActions } from '../garden/GardenStudio';
import { garden } from '../garden/gardenState';
import { paperProgress } from '../garden/KnowledgeGarden';
import { platform } from '../platform';
import { app, go, openPaper, toast } from '../state/app';
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

function Hero() {
  const now = useClock(10000);
  const h = now.getHours();
  const night = h < 5 || h >= 19;
  const greet = h < 5 ? 'Good night' : h < 11 ? 'Good morning' : h < 16 ? 'Good afternoon' : h < 19 ? 'Good evening' : 'Good night';
  return (
    <div className="hero">
      <div className="hero-greet">
        <span>{greet}</span>
        <span className="hero-sun">
          <Icon name={night ? 'moon' : 'sun'} size={26} />
        </span>
      </div>
      <div className="hero-time">{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
      <div className="hero-date">
        <span>{now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>
    </div>
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

function ReadingCard() {
  const { papers, marginal, loaded } = appData.use(s => s);
  const p = papers[0];
  return (
    <section className="card hcard">
      <header className="card-h">
        <Icon name="book" />
        <h3>Continue reading</h3>
      </header>
      {!loaded && <p className="muted">Reading the library…</p>}
      {loaded && (!marginal || !p) && (
        <button className="hc-empty" onClick={() => go('library')}>
          No Marginal data found; open the library
        </button>
      )}
      {p && (
        <button className="hc-paper" onClick={() => openPaper(p)} disabled={!p.pdf} title="Open at the last page">
          <span className="hc-thumb">
            <Icon name="file" size={26} />
          </span>
          <span className="hc-paper-text">
            <span className="paper-title" dir="auto">
              {p.title}
            </span>
            <span className="paper-meta" dir="auto">
              {p.authors?.split(',').slice(0, 2).join(' &')} · {p.year} · page {fa.format(p.lastPage || 1)}
            </span>
          </span>
          <span className="hc-progress">
            <span className="bar">
              <span style={{ width: `${Math.round(paperProgress(p) * 100)}%` }} />
            </span>
            <b>{fa.format(Math.round(paperProgress(p) * 100))}%</b>
          </span>
        </button>
      )}
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
        <Hero />
        <WeatherPill />
        <QuickNav />
        <GardenStudio />
      </div>
      <div className="home-cards">
        <ReadingCard />
        <TimeCard />
        <HabitsCard />
      </div>
      <FlowerCard />
      <InspectCard />
      <PaperActions />
    </div>
  );
}
