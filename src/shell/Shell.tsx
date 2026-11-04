import { appData, refreshAppData } from '../apps/data';
import { FaceLockSettings } from '../lock/FaceLockSettings';
import { AiSettings } from '../ai/AiPanel';
import { app, setPrefs } from '../state/app';
import { Icon } from '../ui/icons';
import { vision, visionStatus } from '../vision/engine';
import { runText } from '../voice/run';
import { listen, stopListening, voiceState } from '../voice/voice';

export function VoiceButton() {
  const v = voiceState.use(s => s);
  const onClick = () => {
    if (v.listening) return stopListening();
    if (!v.supported) {
      app.set({ commandOpen: true });
      return;
    }
    listen(text => runText(text));
  };
  return (
    <div className="voice" data-vision-ignore>
      <button className={`voice-btn ${v.listening ? 'on' : ''}`} onClick={onClick} title={v.supported ? 'Voice command (Ctrl+Shift+Space)' : 'Speech recognition is not available here; type the command'}>
        <Icon name="mic" size={22} />
      </button>
      {v.listening && <div className="voice-bubble">{v.interim || 'Listening…'}</div>}
    </div>
  );
}

export function Toasts() {
  const toasts = app.use(s => s.toasts);
  return (
    <div className="toasts" data-vision-ignore>
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.tone ?? ''}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function Settings() {
  const s = app.use(x => x);
  const apps = appData.use(x => x.apps);
  const vs = visionStatus.use(x => x.state);
  const pickWallpaper = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setPrefs({ wallpaper: String(r.result) });
    r.readAsDataURL(f);
  };
  return (
    <div className="settings">
      <section className="card">
        <header className="card-h">
          <Icon name="garden" />
          <h3>Appearance and garden</h3>
        </header>
        <div className="seg-row">
          <span>Garden mood</span>
          {(
            [
              ['photo', 'Greenhouse at night (photo)', 'moon'],
              ['morning', 'Greenhouse morning', 'sun'],
              ['rainy', 'Rainy greenhouse', 'drop'],
              ['sunset', 'Warm sunset', 'leaf'],
              ['night', 'Painted night', 'moon'],
            ] as const
          ).map(([p, label, icon]) => (
            <button key={p} className={`chip ${s.preset === p ? 'on' : ''}`} onClick={() => setPrefs({ preset: p })}>
              <Icon name={icon} size={16} /> {label}
            </button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={s.companion} onChange={e => setPrefs({ companion: e.target.checked })} />
          Small companion: a bird on a branch that silently reacts to gestures and to the end of a focus session
        </label>
        <label className="check">
          <input type="checkbox" checked={s.reducedMotion} onChange={e => setPrefs({ reducedMotion: e.target.checked })} />
          Reduce motion and animation (power saving)
        </label>
        <label className="check">
          <input type="checkbox" checked={s.gardenProgress} onChange={e => setPrefs({ gardenProgress: e.target.checked })} />
          Flowers bloom as your reading progresses (off = all flowers in bloom, purely decorative)
        </label>
        <div className="seg-row">
          <span>Background</span>
          <button className={`btn ${s.wallpaper === 'windows' ? 'primary' : ''}`} onClick={() => setPrefs({ wallpaper: 'windows' })}>
            Windows desktop wallpaper
          </button>
          <label className="btn">
            Choose image
            <input type="file" accept="image/*" hidden onChange={e => pickWallpaper(e.target.files?.[0])} />
          </label>
          {s.wallpaper && (
            <button className="btn" onClick={() => setPrefs({ wallpaper: null })}>
              Back to the painted garden
            </button>
          )}
        </div>
        <p className="muted small">The image is stored only on this computer. If you use a film still, it is for personal use and should not be published.</p>
      </section>

      <AiSettings />

      <FaceLockSettings />

      <section className="card">
        <header className="card-h">
          <Icon name="apps" />
          <h3>My apps</h3>
          <button className="btn small" onClick={() => refreshAppData()}>
            Refresh
          </button>
        </header>
        <ul className="app-status">
          {(
            [
              ['marginal', 'Marginal: paper and PDF library (read-only)'],
              ['habitwall', 'HabitWall: today’s habits (read-only)'],
              ['rooznegar', 'Rooznegar: today’s time and the running timer (read-only)'],
            ] as const
          ).map(([id, label]) => (
            <li key={id}>
              <span className={`led ${apps[id] ? 'ok' : ''}`} />
              <span>{label}</span>
              <small className="muted" dir="ltr">
                {apps[id] ?? 'not installed'}
              </small>
            </li>
          ))}
        </ul>
        <p className="muted small">Vision OS never changes these apps’ data; it keeps its own highlights and notes separately.</p>
      </section>

      <section className="card">
        <header className="card-h">
          <Icon name="camera" />
          <h3>Camera privacy</h3>
        </header>
        <p>
          Current state: <b>{vs.toLowerCase().replace('_', ' ')}</b>
        </p>
        <ul className="bullets">
          <li>Processing is fully local; no frame is stored or sent anywhere.</li>
          <li>In “Standby” the camera is on and only watches for the wake gesture.</li>
          <li>“Camera off” really releases the camera and its light turns off.</li>
          <li>Shortcuts: Ctrl+Alt+V camera on/off · Esc stop control immediately · Ctrl+K commands · F11 fullscreen.</li>
        </ul>
        <button className="btn" onClick={() => vision.setState('CAMERA_OFF', 'settings')}>
          Turn the camera off
        </button>
      </section>
    </div>
  );
}
