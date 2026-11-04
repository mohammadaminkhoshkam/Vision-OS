// YouTube Learning / Cinema mode via the official IFrame Player API. A transparent layer over
// the video receives clicks and hand gestures; YouTube's own controls are hidden in favour of
// large, hand-friendly ones. Timestamped bookmarks and notes are stored per video locally.
import { useEffect, useRef, useState } from 'react';
import { loadList, saveJson } from '../lib/store';
import { clipVideo } from '../board/store';
import { app, controls, toast } from '../state/app';
import { Icon } from '../ui/icons';
import { useRadialItems, useVisionHandler } from '../vision/router';

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(s: number, allow: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  getVolume(): number;
  setVolume(v: number): void;
  setPlaybackRate(r: number): void;
  getPlaybackRate(): number;
  loadVideoById(o: { videoId: string; startSeconds?: number }): void;
  getVideoData(): { title: string };
  destroy(): void;
}
declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, o: unknown) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;
function loadApi() {
  apiPromise ??= new Promise<void>((resolve, reject) => {
    if (window.YT?.Player) return resolve();
    window.onYouTubeIframeAPIReady = () => resolve();
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => reject(new Error('YouTube API unreachable'));
    document.head.appendChild(s);
  });
  return apiPromise;
}

export function parseVideoId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/);
  return m ? m[1] : null;
}

interface Mark {
  id: string;
  t: number;
  note: string;
}
interface Recent {
  id: string;
  title: string;
  at: number;
}

const fmt = (s: number) => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + `:${String(sec).padStart(2, '0')}`;
};

export function Cinema() {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const pending = useRef(app.get().pendingVideo);
  const [videoId, setVideoId] = useState<string | null>(() => pending.current?.id ?? loadList<Recent>('vos.yt.recent')[0]?.id ?? null);
  const [input, setInput] = useState('');
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(80);
  const [rate, setRate] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [note, setNote] = useState('');
  const [recent, setRecent] = useState<Recent[]>(() => loadList<Recent>('vos.yt.recent'));
  const seekDrag = useRef(false);

  // create the player once a video is chosen
  useEffect(() => {
    if (!videoId) return;
    setMarks(loadList<Mark>(`vos.yt.marks.${videoId}`));
    if (player.current) {
      player.current.loadVideoById({ videoId, startSeconds: Number(localStorage.getItem(`vos.yt.pos.${videoId}`) ?? 0) });
      return;
    }
    let dead = false;
    loadApi()
      .then(() => {
        if (dead || !host.current || !window.YT) return;
        const el = document.createElement('div');
        host.current.replaceChildren(el);
        player.current = new window.YT.Player(el, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: { controls: 0, rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3, cc_load_policy: 1, origin: location.origin, start: Math.floor(Number(localStorage.getItem(`vos.yt.pos.${videoId}`) ?? 0)) },
          events: {
            onReady: () => {
              setReady(true);
              const pv = pending.current;
              if (pv) {
                player.current?.seekTo(pv.t, true);
                pending.current = null;
                app.set({ pendingVideo: null });
              }
            },
            onStateChange: (e: { data: number }) => {
              setPlaying(e.data === 1);
              if (e.data === 1) rememberRecent();
            },
            onError: (e: { data: number }) => setError(`Player error code: ${e.data}`),
          },
        });
      })
      .catch(e => setError(String(e)));
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  useEffect(() => () => player.current?.destroy(), []);

  // poll time; resume position is remembered per video
  useEffect(() => {
    const t = setInterval(() => {
      const p = player.current;
      if (!p || !ready || !p.getCurrentTime) return;
      const ct = p.getCurrentTime();
      if (!seekDrag.current) setTime(ct);
      setDur(p.getDuration() || 0);
      if (videoId && ct > 5) localStorage.setItem(`vos.yt.pos.${videoId}`, String(Math.floor(ct)));
    }, 400);
    return () => clearInterval(t);
  }, [ready, videoId]);

  const rememberRecent = () => {
    const p = player.current;
    if (!p || !videoId) return;
    const title = p.getVideoData?.().title || videoId;
    setRecent(r => {
      const next = [{ id: videoId, title, at: Date.now() }, ...r.filter(x => x.id !== videoId)].slice(0, 12);
      saveJson('vos.yt.recent', next);
      return next;
    });
  };

  const p = () => player.current;
  const toggle = () => (playing ? p()?.pauseVideo() : p()?.playVideo());
  const seekBy = (s: number) => {
    const pl = p();
    if (!pl) return;
    pl.seekTo(Math.max(0, pl.getCurrentTime() + s), true);
    toast(`${s > 0 ? '⏩' : '⏪'} ${Math.abs(s)} s`);
  };
  const volBy = (d: number) => {
    const pl = p();
    if (!pl) return;
    const v = Math.min(100, Math.max(0, pl.getVolume() + d));
    pl.setVolume(v);
    setVol(v);
  };
  const setSpeed = (r: number) => {
    p()?.setPlaybackRate(r);
    setRate(r);
  };
  const addMark = (text = note) => {
    if (!videoId || !p()) return;
    const m = { id: Math.random().toString(36).slice(2, 9), t: Math.floor(p()!.getCurrentTime()), note: text.trim() };
    const next = [...marks, m].sort((a, b) => a.t - b.t);
    setMarks(next);
    saveJson(`vos.yt.marks.${videoId}`, next);
    setNote('');
    toast(`Bookmark at ${fmt(m.t)}`, 'ok');
  };
  const removeMark = (id: string) => {
    const next = marks.filter(m => m.id !== id);
    setMarks(next);
    if (videoId) saveJson(`vos.yt.marks.${videoId}`, next);
  };
  const open = () => {
    const id = parseVideoId(input);
    if (!id) return toast('Not a valid YouTube link or ID', 'warn');
    setError(null);
    setVideoId(id);
    setInput('');
  };

  useEffect(() => {
    controls.current = {
      play: () => p()?.playVideo(),
      pause: () => p()?.pauseVideo(),
      seek: seekBy,
      volume: d => volBy(d * 10),
      bookmark: () => addMark(''),
      search: q => {
        setInput(q);
        toast('YouTube search needs an API key; enter a video link instead', 'warn');
      },
    };
    return () => {
      controls.current = {};
    };
  });

  useVisionHandler(
    (e, px) => {
      const overVideo = px && (document.elementFromPoint(px.x, px.y)?.closest('.yt-shield') ?? null);
      if (e.type === 'SWIPE') {
        if (e.dir === 'right') seekBy(10);
        else if (e.dir === 'left') seekBy(-10);
        return true;
      }
      if (e.type === 'SCROLL' && overVideo) {
        volBy(-e.dy * 60);
        return true;
      }
      return false;
    },
    [playing, ready],
  );

  useRadialItems(
    [
      { id: 'pp', label: playing ? 'Pause' : 'Play', icon: playing ? 'pause' : 'play', run: toggle },
      { id: 'back', label: '−10 s', icon: 'left', run: () => seekBy(-10) },
      { id: 'fwd', label: '+10 s', icon: 'right', run: () => seekBy(10) },
      { id: 'mark', label: 'Bookmark', icon: 'bookmark', run: () => addMark('') },
      { id: 'slow', label: 'Speed', icon: 'clock', run: () => setSpeed(rate >= 2 ? 0.75 : rate + 0.25) },
    ],
    [playing, rate, marks],
  );

  const seekFromBar = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return frac * dur;
  };

  return (
    <div className="cinema">
      <div className="cinema-main">
        <div className="yt-frame">
          {videoId ? <div ref={host} className="yt-host" /> : <div className="yt-empty">Enter a YouTube video link</div>}
          {videoId && <div className="yt-shield" data-vt onClick={toggle} aria-label="Play / pause" role="button" />}
          {!playing && ready && (
            <div className="yt-bigplay">
              <Icon name="play" size={56} fill />
            </div>
          )}
          {error && <div className="yt-error">{error}</div>}
        </div>
        <div className="yt-controls">
          <button className="ibtn big" onClick={() => seekBy(-10)} title="Back 10 seconds">
            <Icon name="left" />
          </button>
          <button className="ibtn big primary" onClick={toggle} title="Play / pause">
            <Icon name={playing ? 'pause' : 'play'} fill />
          </button>
          <button className="ibtn big" onClick={() => seekBy(10)} title="Forward 10 seconds">
            <Icon name="right" />
          </button>
          <span className="yt-time" dir="ltr">
            {fmt(time)} / {fmt(dur)}
          </span>
          <div
            className="seekbar"
            data-vt
            onPointerDown={e => {
              const el = e.currentTarget;
              seekDrag.current = true;
              el.setPointerCapture(e.pointerId);
              setTime(seekFromBar(e.clientX, el));
            }}
            onPointerMove={e => seekDrag.current && setTime(seekFromBar(e.clientX, e.currentTarget))}
            onPointerUp={e => {
              seekDrag.current = false;
              p()?.seekTo(seekFromBar(e.clientX, e.currentTarget), true);
            }}
            onClick={e => p()?.seekTo(seekFromBar(e.clientX, e.currentTarget), true)}
          >
            <div className="seek-fill" style={{ width: `${dur ? (time / dur) * 100 : 0}%` }} />
            {marks.map(m => (
              <span key={m.id} className="seek-mark" style={{ left: `${dur ? (m.t / dur) * 100 : 0}%` }} />
            ))}
          </div>
          <button className="ibtn" onClick={() => volBy(-10)} title="Volume down">
            <Icon name="minus" />
          </button>
          <span className="yt-time">
            <Icon name="volume" size={18} /> {vol}
          </span>
          <button className="ibtn" onClick={() => volBy(10)} title="Volume up">
            <Icon name="plus" />
          </button>
          <select className="speed" value={rate} onChange={e => setSpeed(Number(e.target.value))}>
            {[0.75, 1, 1.25, 1.5, 1.75, 2].map(r => (
              <option key={r} value={r}>
                {r}×
              </option>
            ))}
          </select>
        </div>
      </div>
      <aside className="cinema-side card">
        <div className="yt-open">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && open()} placeholder="YouTube link…" dir="ltr" />
          <button className="btn primary" onClick={open}>
            Open
          </button>
        </div>
        <h4>Bookmarks and timed notes</h4>
        <div className="yt-note">
          <input value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && addMark()} placeholder="Note for this moment…" />
          <button className="btn" onClick={() => addMark()}>
            <Icon name="bookmark" size={18} /> {fmt(time)}
          </button>
        </div>
        <ul className="marks">
          {marks.length === 0 && <li className="muted small">Use “Bookmark” from the radial menu, or say “bookmark”, to save the current moment.</li>}
          {marks.map(m => (
            <li key={m.id}>
              <button className="mark-t" onClick={() => p()?.seekTo(m.t, true)} dir="ltr">
                {fmt(m.t)}
              </button>
              <span dir="auto">{m.note || '—'}</span>
              <button
                className="ibtn tiny"
                onClick={() => videoId && clipVideo(m.note, { kind: 'video', videoId, t: m.t, title: p()?.getVideoData?.().title || videoId })}
                title="Send to the knowledge board"
              >
                <Icon name="board" size={14} />
              </button>
              <button className="ibtn tiny" onClick={() => removeMark(m.id)} aria-label="Delete">
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
        </ul>
        <h4>Recent</h4>
        <ul className="recent">
          {recent.map(r => (
            <li key={r.id}>
              <button className="side-row" onClick={() => setVideoId(r.id)} dir="auto">
                <Icon name="youtube" size={16} /> {r.title}
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
