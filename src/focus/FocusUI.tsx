// Focus Studio (FG-01..05, PP-06/07) and the compact overlay timer (FG-04).
import { useMemo, useState } from 'react';
import { appData } from '../apps/data';
import { app, go, toast } from '../state/app';
import { Icon } from '../ui/icons';
import { AmbientMixer } from './ambient';
import { activeMs, balance, DEFAULT_TAGS, remainingSec, stats, type FocusLink, type TimerMode } from './engine';
import { addTask, current, focus, removeTask, setFocusPrefs, start, stop, toggleTask, togglePause, useNow } from './store';

const fa = new Intl.NumberFormat('en-US');
const clock = (sec: number) => {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export function sessionClock(now: number) {
  const s = current();
  if (!s) return null;
  return s.mode === 'pomodoro' ? clock(remainingSec(s, now)) : clock(activeMs(s, now) / 1000);
}

/** Small translucent timer pinned over every screen while a session runs. */
export function FocusOverlay() {
  const { sessions, overlayHidden, breakSuggestion } = focus.use(s => s);
  const now = useNow();
  const s = sessions.find(x => x.status === 'running' || x.status === 'paused');
  if (breakSuggestion && !s)
    return (
      <div className="focus-pill break" data-vision-ignore>
        <Icon name="leaf" size={18} />
        <span>Time for an optional {fa.format(breakSuggestion.minutes)}-minute break</span>
        <button className="ibtn tiny" onClick={() => start('pomodoro', breakSuggestion.minutes, 'Break', null)} title="Start break">
          <Icon name="play" size={14} />
        </button>
        <button className="ibtn tiny" onClick={() => focus.set({ breakSuggestion: null })} title="Dismiss">
          <Icon name="close" size={14} />
        </button>
      </div>
    );
  if (!s || overlayHidden) return null;
  const pct = s.mode === 'pomodoro' ? 1 - remainingSec(s, now) / s.plannedSec : ((activeMs(s, now) / 60000) % 60) / 60;
  return (
    <div className={`focus-pill ${s.status}`}>
      <svg width="30" height="30" viewBox="0 0 30 30" className="focus-ring">
        <circle cx="15" cy="15" r="12" className="ring-bg" />
        <circle cx="15" cy="15" r="12" className="ring-fg" strokeDasharray={`${75.4 * pct} 75.4`} transform="rotate(-90 15 15)" />
      </svg>
      <button className="focus-time" onClick={() => go('focus')} dir="ltr" title="Focus Studio">
        {s.mode === 'pomodoro' ? clock(remainingSec(s, now)) : clock(activeMs(s, now) / 1000)}
      </button>
      <span className="focus-tag" dir="auto">{s.link?.title ?? s.tag}</span>
      <button className="ibtn tiny" onClick={togglePause} title={s.status === 'running' ? 'Pause' : 'Resume'}>
        <Icon name={s.status === 'running' ? 'pause' : 'play'} size={14} />
      </button>
      <button className="ibtn tiny" onClick={() => stop('completed')} title="End session">
        <Icon name="check" size={14} />
      </button>
      <button className="ibtn tiny" onClick={() => focus.set({ overlayHidden: true })} title="Hide">
        <Icon name="minus" size={14} />
      </button>
    </div>
  );
}

function linkCandidates(): FocusLink[] {
  const out: FocusLink[] = [];
  const doc = app.get().doc;
  if (doc?.source === 'marginal') out.push({ kind: 'paper', id: doc.paper.id, title: doc.paper.title });
  for (const p of appData.get().papers.slice(0, 5)) if (!out.some(o => o.id === p.id)) out.push({ kind: 'paper', id: p.id, title: p.title });
  return out;
}

export function FocusStudio() {
  const st = focus.use(s => s);
  const now = useNow();
  const s = st.sessions.find(x => x.status === 'running' || x.status === 'paused') ?? null;
  const [mode, setMode] = useState<TimerMode>('pomodoro');
  const [minutes, setMinutes] = useState(st.defaultMinutes);
  const [tag, setTag] = useState(DEFAULT_TAGS[0]);
  const [linkId, setLinkId] = useState<string>('');
  const [newTag, setNewTag] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const links = useMemo(linkCandidates, []);
  const stat = stats(st.sessions, now);
  const maxDay = Math.max(30, ...stat.week.map(d => d.minutes));
  const tags = [...DEFAULT_TAGS, ...st.customTags];

  return (
    <div className="focus-studio">
      <section className="card focus-main">
        <header className="card-h">
          <Icon name="timer" />
          <h3>Focus studio</h3>
          {st.rewardMode && <span className="card-src">💧 {fa.format(balance(st.ledger))} dew drops</span>}
        </header>

        {s ? (
          <div className="focus-running">
            <div className="focus-big" dir="ltr">
              {s.mode === 'pomodoro' ? clock(remainingSec(s, now)) : clock(activeMs(s, now) / 1000)}
            </div>
            <div className="muted">
              {s.mode === 'pomodoro' ? 'Pomodoro' : 'Flowtime'} · {s.tag}
              {s.link && <> · <span dir="auto">{s.link.title}</span></>}
            </div>
            <div className="focus-actions">
              <button className="btn big" onClick={togglePause}>
                <Icon name={s.status === 'running' ? 'pause' : 'play'} /> {s.status === 'running' ? 'Pause' : 'Resume'}
              </button>
              <button className="btn big primary" onClick={() => stop('completed')}>
                <Icon name="check" /> Finish and log
              </button>
              <button className="btn big" onClick={() => stop('cancelled')}>
                <Icon name="close" /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="focus-setup">
            <div className="seg-row">
              <button className={`chip ${mode === 'pomodoro' ? 'on' : ''}`} onClick={() => setMode('pomodoro')}>
                Pomodoro (countdown)
              </button>
              <button className={`chip ${mode === 'flowtime' ? 'on' : ''}`} onClick={() => setMode('flowtime')}>
                Flowtime (count up)
              </button>
            </div>
            {mode === 'pomodoro' && (
              <div className="seg-row">
                <span>Duration</span>
                {[15, 25, 50, 90].map(m => (
                  <button key={m} className={`chip ${minutes === m ? 'on' : ''}`} onClick={() => setMinutes(m)}>
                    {fa.format(m)} min
                  </button>
                ))}
              </div>
            )}
            <div className="seg-row">
              <span>Tag</span>
              {tags.map(t => (
                <button key={t} className={`chip ${tag === t ? 'on' : ''}`} onClick={() => setTag(t)}>
                  {t}
                </button>
              ))}
              <input className="pin-input" value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="New tag" />
              <button
                className="btn small"
                onClick={() => {
                  if (!newTag.trim()) return;
                  setFocusPrefs({ customTags: [...st.customTags, newTag.trim()] });
                  setTag(newTag.trim());
                  setNewTag('');
                }}
              >
                Add
              </button>
            </div>
            <div className="seg-row">
              <span>Link to</span>
              <select className="speed" value={linkId} onChange={e => setLinkId(e.target.value)}>
                <option value="">— No link —</option>
                {links.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.title.slice(0, 60)}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn big primary" onClick={() => start(mode, minutes, tag, links.find(l => l.id === linkId) ?? null)}>
              <Icon name="play" /> Start session
            </button>
          </div>
        )}
      </section>

      <section className="card">
        <header className="card-h">
          <Icon name="clock" />
          <h3>Today and this week</h3>
          <span className="card-src">{fa.format(stat.todayMin)} min · {fa.format(stat.sessions)} sessions</span>
        </header>
        <div className="week-bars">
          {stat.week.map((d, i) => (
            <div key={i} className="week-col" title={`${d.minutes} min`}>
              <span style={{ height: `${(d.minutes / maxDay) * 100}%` }} className={i === 6 ? 'today' : ''} />
              <small>{i === 6 ? 'Today' : new Date(Date.now() + d.label * 86400000).toLocaleDateString('en-US', { weekday: 'short' })}</small>
            </div>
          ))}
        </div>
        <ul className="proj-list">
          {stat.byTag.length === 0 && <li className="muted small">No sessions logged yet.</li>}
          {stat.byTag.map(t => (
            <li key={t.tag}>
              <span className="habit-dot" style={{ background: 'var(--moss)' }} />
              <span>{t.tag}</span>
              <span className="muted small">{fa.format(t.minutes)} min</span>
            </li>
          ))}
        </ul>
        <label className="check">
          <input type="checkbox" checked={st.rewardMode} onChange={e => setFocusPrefs({ rewardMode: e.target.checked })} />
          Dew-drop rewards for the garden (no pressure; being away never breaks anything)
        </label>
      </section>

      <section className="card">
        <header className="card-h">
          <Icon name="check" />
          <h3>Tasks</h3>
        </header>
        <div className="yt-note">
          <input
            value={taskTitle}
            onChange={e => setTaskTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && taskTitle.trim()) {
                addTask(taskTitle.trim(), tag);
                setTaskTitle('');
              }
            }}
            placeholder="New task… (Enter)"
          />
        </div>
        <ul className="habit-list">
          {st.tasks.map(t => (
            <li key={t.id} className={t.done ? 'done' : ''}>
              <button className="habit-dot task-check" style={{ background: t.done ? 'var(--moss)' : 'transparent' }} onClick={() => toggleTask(t.id)} aria-label="Done">
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

      <section className="card">
        <header className="card-h">
          <Icon name="volume" />
          <h3>Ambient sound</h3>
        </header>
        <AmbientMixer />
      </section>
    </div>
  );
}

export function focusOnPaper(link: FocusLink) {
  start('pomodoro', focus.get().defaultMinutes, 'Research', link);
  toast('Focus session started', 'ok');
}
