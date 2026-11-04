// Settings section for running the usability test described in docs/usability-test.md.
import { useState } from 'react';
import { Icon } from '../ui/icons';
import { analyze, TASKS, toCsv } from './analyze';
import { clearStudy, startStudy, stopStudy, study } from './recorder';

function download(name: string, text: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
}

export function StudyPanel() {
  const s = study.use(x => x);
  const [who, setWho] = useState(s.participant);
  const [build, setBuild] = useState(s.build);
  const results = analyze(s.events);
  return (
    <section className="card study">
      <header className="card-h">
        <Icon name="chart" />
        <h3>Usability study</h3>
        {s.active && <span className="card-src rec">● recording</span>}
      </header>
      <p className="muted small">
        For testing the design with 5–8 people: ask them to do the four tasks below without help while this records times, warnings and navigation on this computer only. Export the results and compare builds. See docs/usability-test.md.
      </p>
      <ol className="study-tasks">
        {TASKS.map((t, i) => {
          const r = results[i];
          return (
            <li key={t.id} className={r.done ? 'done' : ''}>
              <b>{t.label}</b>
              <span className="muted small">{t.instruction}</span>
              {s.events.length > 0 && (
                <span className="study-res">
                  {r.done ? `${((r.ms ?? 0) / 1000).toFixed(1)} s` : 'not yet'} · {r.errors} warnings · {r.navigations} screens{r.pingPongs ? ` · ${r.pingPongs} back-and-forth` : ''}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <div className="seg-row">
        <input className="pin-input" value={who} onChange={e => setWho(e.target.value)} placeholder="Participant code (P1…)" aria-label="Participant code" disabled={s.active} />
        <select value={build} onChange={e => setBuild(e.target.value)} disabled={s.active} aria-label="Build being tested">
          <option value="redesign">This build (redesign)</option>
          <option value="baseline">Baseline (0.4)</option>
        </select>
        {s.active ? (
          <button className="btn primary" onClick={stopStudy}>
            Stop
          </button>
        ) : (
          <button className="btn primary" onClick={() => startStudy(who, build)}>
            Start
          </button>
        )}
        <button className="btn" disabled={!s.events.length} onClick={() => download(`vision-study-${s.participant}.csv`, toCsv(s.participant, s.build, results), 'text/csv')}>
          Export CSV
        </button>
        <button className="btn" disabled={!s.events.length} onClick={() => download(`vision-study-${s.participant}.json`, JSON.stringify(s, null, 2), 'application/json')}>
          Raw log
        </button>
        <button className="btn" disabled={s.active || !s.events.length} onClick={clearStudy}>
          Clear
        </button>
      </div>
    </section>
  );
}
