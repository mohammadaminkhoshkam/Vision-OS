// Planner: today's schedule (timed items with reminders), tasks (+ HabitWall habits, read-only)
// and statistics (focus, Rooznegar time, reading progress).
import { useState } from 'react';
import { appData } from '../apps/data';
import { stats } from '../focus/engine';
import { addTask, focus, removeTask, todayKey, toggleTask, useNow } from '../focus/store';
import { paperProgress } from '../garden/KnowledgeGarden';
import { app, openPaper, type PlannerTab } from '../state/app';
import { Icon } from '../ui/icons';

const fa = new Intl.NumberFormat('en-US');
const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

function Schedule() {
  const tasks = focus.use(s => s.tasks);
  const today = todayKey();
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00');
  const [high, setHigh] = useState(false);
  const [daily, setDaily] = useState(false);
  const items = tasks.filter(t => t.time && (!t.day || t.day === today)).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  const add = () => {
    if (!title.trim()) return;
    addTask(title.trim(), 'Schedule', { time, priority: high ? 'high' : 'normal', day: daily ? undefined : today });
    setTitle('');
  };
  return (
    <div className="pl-grid">
      <section className="card pl-card">
        <header className="card-h">
          <Icon name="calendar" />
          <h3>Today’s schedule</h3>
          <span className="card-src">{new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </header>
        <ul className="sched big">
          {items.length === 0 && <li className="muted small">Nothing scheduled for today yet.</li>}
          {items.map(t => (
            <li key={t.id} className={t.done ? 'done' : ''}>
              <button className={`hcheck ${t.done ? 'on' : ''}`} onClick={() => toggleTask(t.id)} aria-label="Done">
                {t.done && <Icon name="check" size={14} stroke={3} />}
              </button>
              <span className={`sched-dot ${t.done ? 'ok' : t.priority === 'high' ? 'hi' : 'mid'}`} />
              <span dir="auto">{t.title}</span>
              {!t.day && <span className="muted small">Every day</span>}
              <span className="sched-time">{t.time}</span>
              <button className="ibtn tiny" onClick={() => removeTask(t.id)} aria-label="Delete">
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="card pl-card">
        <header className="card-h">
          <Icon name="plus" />
          <h3>Add to schedule</h3>
        </header>
        <div className="pl-form">
          <input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="e.g. weekly group meeting, report deadline…" />
          <input type="time" value={time} onChange={e => setTime(e.target.value)} dir="ltr" />
          <label className="check">
            <input type="checkbox" checked={high} onChange={e => setHigh(e.target.checked)} /> High priority
          </label>
          <label className="check">
            <input type="checkbox" checked={daily} onChange={e => setDaily(e.target.checked)} /> Repeat every day
          </label>
          <button className="btn primary" onClick={add}>
            <Icon name="plus" size={18} /> Add
          </button>
          <p className="muted small">At the set time, a reminder appears in the notifications (bell) and at the bottom of the screen.</p>
        </div>
      </section>
    </div>
  );
}

function Tasks() {
  const tasks = focus.use(s => s.tasks.filter(t => !t.time));
  const { habits, habitwall } = appData.use(s => s);
  const [title, setTitle] = useState('');
  return (
    <div className="pl-grid">
      <section className="card pl-card">
        <header className="card-h">
          <Icon name="tasks" />
          <h3>Tasks</h3>
          <span className="card-src">
            {fa.format(tasks.filter(t => t.done).length)}/{fa.format(tasks.length)}
          </span>
        </header>
        <div className="yt-note">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && title.trim()) {
                addTask(title.trim(), 'Research');
                setTitle('');
              }
            }}
            placeholder="New task… (Enter)"
          />
        </div>
        <ul className="sched big">
          {tasks.map(t => (
            <li key={t.id} className={t.done ? 'done' : ''}>
              <button className={`hcheck ${t.done ? 'on' : ''}`} onClick={() => toggleTask(t.id)} aria-label="Done">
                {t.done && <Icon name="check" size={14} stroke={3} />}
              </button>
              <span dir="auto">{t.title}</span>
              <span className="muted small">{t.tag}</span>
              <button className="ibtn tiny" onClick={() => removeTask(t.id)} aria-label="Delete">
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
        </ul>
      </section>
      {habitwall && (
        <section className="card pl-card">
          <header className="card-h">
            <Icon name="leaf" />
            <h3>Today’s habits (HabitWall)</h3>
          </header>
          <ul className="sched big">
            {habits.map(h => (
              <li key={h.id} className={h.done ? 'done' : ''}>
                <span className={`hcheck ${h.done ? 'on' : ''}`}>{h.done && <Icon name="check" size={14} stroke={3} />}</span>
                <span dir="auto">{h.title}</span>
                {h.unit && (
                  <span className="muted small">
                    {fa.format(h.value)}/{fa.format(h.target)} {h.unit}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="muted small">Habits are checked off in HabitWall itself; Vision OS never changes its data.</p>
        </section>
      )}
    </div>
  );
}

function Stats() {
  const sessions = focus.use(s => s.sessions);
  const { rooz, papers } = appData.use(s => s);
  const now = useNow(60000);
  const st = stats(sessions, now);
  const max = Math.max(30, ...st.week.map(d => d.minutes));
  return (
    <div className="pl-grid three">
      <section className="card pl-card">
        <header className="card-h">
          <Icon name="timer" />
          <h3>Focus this week</h3>
          <span className="card-src">Today {hm(st.todayMin)}</span>
        </header>
        <div className="week-bars">
          {st.week.map((d, i) => (
            <div key={i} className="week-col" title={`${d.minutes} min`}>
              <span style={{ height: `${(d.minutes / max) * 100}%` }} className={i === 6 ? 'today' : ''} />
              <small>{i === 6 ? 'Today' : new Date(Date.now() + d.label * 86400000).toLocaleDateString('en-US', { weekday: 'short' })}</small>
            </div>
          ))}
        </div>
        <ul className="proj-list">
          {st.byTag.map(t => (
            <li key={t.tag}>
              <span className="habit-dot" style={{ background: '#8bd56e' }} />
              <span>{t.tag}</span>
              <span className="muted small">{hm(t.minutes)}</span>
            </li>
          ))}
        </ul>
      </section>
      {rooz?.available && (
        <section className="card pl-card">
          <header className="card-h">
            <Icon name="clock" />
            <h3>Rooznegar</h3>
            <span className="card-src">Week {hm(rooz.weekMinutes)}</span>
          </header>
          <div className="time-big">{hm(rooz.todayMinutes)}</div>
          <p className="muted small">Today, of a {hm(rooz.goalMinutes)} goal</p>
          <ul className="proj-list">
            {rooz.top.map(t => (
              <li key={t.name}>
                <span className="habit-dot" style={{ background: t.color }} />
                <span>{t.name}</span>
                <span className="muted small">{hm(t.minutes)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="card pl-card">
        <header className="card-h">
          <Icon name="book" />
          <h3>Reading progress</h3>
        </header>
        <ul className="read-progress">
          {papers.map(p => (
            <li key={p.id}>
              <button className="link" onClick={() => openPaper(p)} dir="auto">
                {p.title.slice(0, 60)}
              </button>
              <span className="bar">
                <span style={{ width: `${Math.round(paperProgress(p) * 100)}%` }} />
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function Planner() {
  const tab = app.use(s => s.plannerTab);
  const set = (t: PlannerTab) => app.set({ plannerTab: t });
  const titles: Record<PlannerTab, string> = { schedule: 'Schedule', tasks: 'Tasks', stats: 'Stats' };
  return (
    <div className="panel-screen">
      <header className="ps-head">
        <Icon name={tab === 'schedule' ? 'calendar' : tab === 'tasks' ? 'tasks' : 'chart'} size={26} />
        <h2>{titles[tab]}</h2>
        <div className="ps-tabs">
          {(Object.keys(titles) as PlannerTab[]).map(t => (
            <button key={t} className={`chip ${tab === t ? 'on' : ''}`} onClick={() => set(t)}>
              {titles[t]}
            </button>
          ))}
        </div>
      </header>
      <div className="ps-body">{tab === 'schedule' ? <Schedule /> : tab === 'tasks' ? <Tasks /> : <Stats />}</div>
    </div>
  );
}
