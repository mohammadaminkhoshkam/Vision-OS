// Custom window title bar: logo + name, central search (opens the launcher), voice,
// notifications, profile menu and real window controls (Tauri). Drag the bar to move the window.
import { useEffect, useRef, useState } from 'react';
import { lock, lockNow } from '../lock/lock';
import { isTauri, platform } from '../platform';
import { notes, markSeen, clearNotes, unread } from '../state/notifications';
import { app, go, setPrefs } from '../state/app';
import { Icon } from '../ui/icons';
import { WorkspaceTabs } from './WorkspaceTabs';
import { runText } from '../voice/run';
import { listen, stopListening, voiceState } from '../voice/voice';

async function win() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  return getCurrentWindow();
}

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m.toLocaleString('en-US')} min ago` : `${Math.round(m / 60).toLocaleString('en-US')} h ago`;
};

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const on = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    setTimeout(() => addEventListener('mousedown', on), 0);
    return () => removeEventListener('mousedown', on);
  }, [open, close]);
  return ref;
}

function Bell() {
  const s = notes.use(x => x);
  const n = unread(s);
  const close = () => notes.set({ open: false });
  const ref = useOutside(s.open, close);
  return (
    <div className="tb-pop-wrap" ref={ref}>
      <button
        className="tb-icon"
        onClick={() => {
          notes.set({ open: !s.open });
          markSeen();
        }}
        title="Notifications"
      >
        <Icon name="bell" size={20} />
        {n > 0 && <span className="tb-dot" />}
      </button>
      {s.open && (
        <div className="tb-pop">
          <header>
            <b>Notifications</b>
            {s.list.length > 0 && (
              <button className="link" onClick={clearNotes}>
                Clear
              </button>
            )}
          </header>
          {s.list.length === 0 && <p className="muted small">No notifications.</p>}
          {[...s.list].reverse().map(x => (
            <div key={x.id} className={`tb-note ${x.tone}`}>
              <span>{x.text}</span>
              <small>{ago(x.at)}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Profile() {
  const name = app.use(s => s.userName);
  const lockOn = lock.use(s => s.enabled && !!s.pinHash);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const ref = useOutside(open, () => (setOpen(false), setEditing(false)));
  return (
    <div className="tb-pop-wrap" ref={ref}>
      <button className="tb-profile" onClick={() => setOpen(!open)}>
        <span className="tb-avatar">
          <Icon name="user" size={18} />
        </span>
        <span>{name || 'Researcher'}</span>
        <Icon name="chevron" size={16} />
      </button>
      {open && (
        <div className="tb-pop tb-menu">
          {editing ? (
            <div className="tb-name">
              <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Display name" autoFocus onKeyDown={e => e.key === 'Enter' && (setPrefs({ userName: draft.trim() }), setEditing(false))} />
              <button className="btn small primary" onClick={() => (setPrefs({ userName: draft.trim() }), setEditing(false))}>
                Save
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)}>
              <Icon name="edit" size={16} /> Rename
            </button>
          )}
          <button onClick={() => (setOpen(false), go('settings'))}>
            <Icon name="settings" size={16} /> Settings
          </button>
          <button onClick={() => (setOpen(false), go('calibrate'))}>
            <Icon name="hand" size={16} /> Gestures and calibration
          </button>
          {lockOn && (
            <button onClick={() => (setOpen(false), lockNow())}>
              <Icon name="lens" size={16} /> Lock
            </button>
          )}
          {isTauri && (
            <button onClick={() => void platform.exit()}>
              <Icon name="power" size={16} /> Quit
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Voice() {
  const v = voiceState.use(s => s);
  return (
    <div className="tb-pop-wrap">
      <button
        className={`tb-icon ${v.listening ? 'rec' : ''}`}
        onClick={() => {
          if (v.listening) return stopListening();
          if (!v.supported) return app.set({ commandOpen: true });
          listen(text => runText(text));
        }}
        title={v.supported ? 'Voice command (Ctrl+Shift+Space)' : 'Speech recognition is not available here; type the command'}
      >
        <Icon name="mic" size={19} />
      </button>
      {v.listening && <div className="tb-pop voice-pop">{v.interim || 'Listening…'}</div>}
    </div>
  );
}

/** Window strip (Windows layout: brand left, window controls right) + floating search/profile row. */
export function TitleBar() {
  return (
    <>
      <header className="titlebar" data-tauri-drag-region>
        <div className="tb-brand" data-tauri-drag-region>
          <Icon name="leaf" size={22} />
          <span data-tauri-drag-region>Vision OS</span>
        </div>
        <WorkspaceTabs />
        <div className="tb-drag" data-tauri-drag-region />
        {isTauri && (
          <div className="tb-win">
            <button onClick={() => void win().then(w => w.minimize())} title="Minimize">
              <Icon name="winMin" size={16} />
            </button>
            <button onClick={() => void win().then(w => w.toggleMaximize())} title="Maximize">
              <Icon name="winMax" size={14} />
            </button>
            <button className="close" onClick={() => void platform.exit()} title="Close">
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
      </header>
      <div className="topbar">
        <div className="tb-right">
          <Profile />
          <span className="tb-sep" />
          <Bell />
          <Voice />
        </div>
        <button className="tb-search" onClick={() => app.set({ commandOpen: true })} title="Ctrl+K">
          <span>Search papers, books, notes and more…</span>
          <Icon name="search" size={18} />
        </button>
      </div>
    </>
  );
}
