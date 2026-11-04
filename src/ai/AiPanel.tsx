// Research assistant drawer (local Ollama) + its settings card.
import { useEffect } from 'react';
import { Icon } from '../ui/icons';
import { isVisionModel, RECOMMENDED } from './ollama';
import { ACTIONS, ROLES, toBlocks } from './prompts';
import { carryProps } from '../board/carry';
import { ai, answerToBoard, cancelAssistant, checkStatus, closeAssistant, pullModel, runAssistant, setAiSettings } from './store';

const fa = new Intl.NumberFormat('en-US');

/** Inline **bold** and `code` only; everything else is plain text (no HTML injection). */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : p.startsWith('`') && p.endsWith('`') ? <code key={i}>{p.slice(1, -1)}</code> : <span key={i}>{p}</span>,
      )}
    </>
  );
}

export function Answer({ text }: { text: string }) {
  return (
    <div className="ai-answer" dir="auto">
      {toBlocks(text).map((b, i) =>
        b.kind === 'h' ? (
          <h5 key={i}>
            <Inline text={b.text} />
          </h5>
        ) : b.kind === 'li' ? (
          <div key={i} className="ai-li">
            • <Inline text={b.text} />
          </div>
        ) : (
          <p key={i} dir="auto">
            <Inline text={b.text} />
          </p>
        ),
      )}
    </div>
  );
}

function Setup() {
  const { status, pulling } = ai.use(s => s);
  if (!status.ok)
    return (
      <div className="ai-setup">
        <h4>Ollama not found</h4>
        <ol>
          <li>
            Install Ollama from <b dir="ltr">ollama.com/download</b>, or in a terminal: <code dir="ltr">winget install Ollama.Ollama</code>
          </li>
          <li>Start the Ollama app (it appears next to the Windows clock).</li>
          <li>Press “Check again” here and install a model.</li>
        </ol>
        <button className="btn primary" onClick={() => void checkStatus()}>
          Check again
        </button>
        <p className="muted small">Everything runs on this computer; no text or images are sent to the internet.</p>
      </div>
    );
  if (status.models.length) return null;
  return (
    <div className="ai-setup">
      <h4>No model installed yet</h4>
      {RECOMMENDED.map(r => (
        <div key={r.name} className="ai-rec">
          <div>
            <b dir="ltr">{r.name}</b> <span className="muted small">({r.size})</span>
            <div className="muted small">{r.note}</div>
          </div>
          <button className="btn small" disabled={!!pulling} onClick={() => void pullModel(r.name)}>
            Install
          </button>
        </div>
      ))}
      {pulling && <PullProgress />}
    </div>
  );
}

function PullProgress() {
  const p = ai.use(s => s.pulling);
  if (!p) return null;
  return (
    <div className="ai-pull">
      <div className="small" dir="ltr">
        {p.model} — {p.status} {p.frac !== null && `${Math.round(p.frac * 100)}%`}
      </div>
      <span className="bar">
        <span style={{ width: `${Math.round((p.frac ?? 0) * 100)}%` }} />
      </span>
    </div>
  );
}

export function AiPanel() {
  const s = ai.use(x => x);
  useEffect(() => {
    if (s.open && !s.status.checked) void checkStatus();
  }, [s.open, s.status.checked]);
  if (!s.open || !s.ctx) return null;
  const src = s.ctx.source;
  const ready = s.status.ok && !!s.settings.model;
  const imageIgnored = !!s.ctx.image && ready && !isVisionModel(s.settings.model);
  return (
    <aside className="ai-panel">
      <header className="card-h">
        <Icon name="sparkle" />
        <h3>Research assistant</h3>
        {ready && (
          <select className="ai-model" value={s.settings.model} onChange={e => setAiSettings({ model: e.target.value })} dir="ltr">
            {s.status.models.map(m => (
              <option key={m.name} value={m.name}>
                {m.name}
                {isVisionModel(m) ? ' 👁' : ''}
              </option>
            ))}
          </select>
        )}
        <button className="ibtn tiny" onClick={closeAssistant} aria-label="Close">
          <Icon name="close" size={16} />
        </button>
      </header>

      <div className="ai-ground">
        {src && (
          <span className="cite" dir="auto">
            {src.kind === 'pdf' ? `${src.title.slice(0, 40)} · p. ${fa.format(src.page)}` : `${src.title.slice(0, 40)}`}
          </span>
        )}
        {s.ctx.image && <img src={s.ctx.image} alt="figure" />}
        {s.ctx.excerpt && (
          <blockquote dir="auto">{s.ctx.excerpt.length > 420 ? s.ctx.excerpt.slice(0, 420) + '…' : s.ctx.excerpt}</blockquote>
        )}
        {imageIgnored && <p className="ai-warn">This model cannot see images; choose or install gemma3:4b to explain charts.</p>}
      </div>

      <Setup />

      {ready && (
        <>
          <div className="seg-row">
            {ROLES.map(r => (
              <button key={r.id} className={`chip ${s.settings.role === r.id ? 'on' : ''}`} onClick={() => setAiSettings({ role: r.id })}>
                {r.label}
              </button>
            ))}
          </div>
          <div className="seg-row">
            {ACTIONS.map(a => (
              <button
                key={a.id}
                className={`chip ${s.action === a.id ? 'on' : ''}`}
                onClick={() => {
                  ai.set({ action: a.id });
                  void runAssistant();
                }}
                disabled={s.running}
              >
                {a.label}
              </button>
            ))}
          </div>
          <div className="yt-note">
            <input
              value={s.question}
              onChange={e => ai.set({ question: e.target.value })}
              onKeyDown={e => {
                if (e.key === 'Enter' && s.question.trim()) {
                  ai.set({ action: 'ask' });
                  void runAssistant();
                }
              }}
              placeholder="Your own question about this part… (Enter)"
              dir="auto"
            />
            <button
              className="btn primary"
              disabled={s.running || !s.question.trim()}
              onClick={() => {
                ai.set({ action: 'ask' });
                void runAssistant();
              }}
            >
              Ask
            </button>
          </div>
        </>
      )}

      <div className="ai-out">
        {s.running && !s.answer && <div className="ai-thinking">Thinking… (the first answer may take a few seconds)</div>}
        {s.answer && (
          <div className="ai-carry" {...(s.running ? {} : carryProps({ type: 'ai', text: `${s.answer.trim()}\n\n— ${s.usedModel} · local model answer; check before citing`, source: s.ctx?.source ?? null }))}>
            <Answer text={s.answer} />
          </div>
        )}
        {s.error && <p className="ai-warn">Error: {s.error}</p>}
      </div>

      {(s.answer || s.running) && (
        <footer className="ai-foot">
          {s.running ? (
            <button className="btn" onClick={cancelAssistant}>
              <Icon name="close" size={16} /> Stop
            </button>
          ) : (
            <>
              <button className="btn primary" onClick={answerToBoard}>
                <Icon name="board" size={16} /> To knowledge board
              </button>
              <button className="btn" onClick={() => void navigator.clipboard?.writeText(s.answer)}>
                Copy
              </button>
            </>
          )}
          <span className="muted small">This answer comes from a local model; check it before citing.</span>
        </footer>
      )}
    </aside>
  );
}

export function AiSettings() {
  const s = ai.use(x => x);
  useEffect(() => {
    void checkStatus();
  }, []);
  return (
    <section className="card">
      <header className="card-h">
        <Icon name="sparkle" />
        <h3>Local AI (Ollama)</h3>
        <span className="card-src">{s.status.ok ? `Connected · ${s.status.version}` : s.status.checked ? 'Not found' : '…'}</span>
      </header>
      {s.status.ok ? (
        <>
          <div className="seg-row">
            <span>Model</span>
            <select className="speed" value={s.settings.model} onChange={e => setAiSettings({ model: e.target.value })} dir="ltr">
              {s.status.models.map(m => (
                <option key={m.name} value={m.name}>
                  {m.name} · {(m.size / 1e9).toFixed(1)} GB{isVisionModel(m) ? ' · vision' : ''}
                </option>
              ))}
            </select>
          </div>
          <label className="slider">
            <span>
              Creativity (temperature) <b dir="ltr">{s.settings.temperature.toFixed(1)}</b>
            </span>
            <input type="range" min={0} max={1} step={0.1} value={s.settings.temperature} onChange={e => setAiSettings({ temperature: Number(e.target.value) })} />
          </label>
          <h4>Install another model</h4>
          {RECOMMENDED.filter(r => !s.status.models.some(m => m.name === r.name)).map(r => (
            <div key={r.name} className="ai-rec">
              <div>
                <b dir="ltr">{r.name}</b> <span className="muted small">({r.size})</span>
                <div className="muted small">{r.note}</div>
              </div>
              <button className="btn small" disabled={!!s.pulling} onClick={() => void pullModel(r.name)}>
                Install
              </button>
            </div>
          ))}
          <PullProgress />
        </>
      ) : (
        <Setup />
      )}
      <p className="muted small">
        Suggested for a GTX 1660 Ti (6 GB): <span dir="ltr">gemma3:4b</span>. No data is sent to any cloud service.
      </p>
    </section>
  );
}
