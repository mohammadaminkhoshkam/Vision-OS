// Settings card: set a PIN, enroll the face, test the match live, enable the lock.
import { useEffect, useRef, useState } from 'react';
import { toast } from '../state/app';
import { Icon } from '../ui/icons';
import { enroll, hashPin, score, template } from './face';
import { lock, lockNow, openFaceCam, saveLock, type FaceFrame } from './lock';

const KEY_DOTS = [33, 133, 263, 362, 1, 4, 6, 168, 98, 327, 152, 10, 234, 454, 172, 397, 70, 300, 105, 334, 199, 93, 323];

export function FaceLockSettings() {
  const { enabled, enrollment, pinHash } = lock.use(s => s);
  const [pin, setPin] = useState('');
  const [mode, setMode] = useState<'idle' | 'enroll' | 'test'>('idle');
  const [progress, setProgress] = useState(0);
  const [live, setLive] = useState<number | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (mode === 'idle') return;
    const samples: number[][] = [];
    let stop: (() => void) | null = null;
    let dead = false;
    let lastSample = 0;
    const draw = (f: FaceFrame | null) => {
      const c = canvas.current;
      if (!c) return;
      const g = c.getContext('2d')!;
      g.clearRect(0, 0, c.width, c.height);
      if (!f) return;
      g.fillStyle = '#d6b46a';
      for (const i of KEY_DOTS) {
        g.beginPath();
        g.arc((1 - f.lm[i].x) * c.width, f.lm[i].y * c.height, 3, 0, Math.PI * 2);
        g.fill();
      }
    };
    openFaceCam(f => {
      if (dead) return;
      draw(f);
      if (!f) return;
      const t = template(f.lm, f.aspect);
      if (mode === 'enroll' && f.t - lastSample > 120) {
        lastSample = f.t;
        samples.push(t);
        setProgress(samples.length / 48);
        if (samples.length >= 48) {
          dead = true;
          const e = enroll(samples);
          saveLock({ enrollment: e });
          toast('Face enrolled', 'ok');
          setMode('test');
        }
      } else if (mode === 'test') {
        const e = lock.get().enrollment;
        if (e) setLive(score(e, t));
      }
    }, video.current ?? undefined)
      .then(s => {
        stop = s;
        if (dead && mode === 'enroll') s();
      })
      .catch(e => {
        toast(`Camera: ${e}`, 'warn');
        setMode('idle');
      });
    return () => {
      dead = true;
      stop?.();
    };
  }, [mode]);

  const savePin = async () => {
    if (!/^\d{4,8}$/.test(pin)) return toast('The PIN must be 4 to 8 digits', 'warn');
    saveLock({ pinHash: await hashPin(pin) });
    setPin('');
    toast('PIN saved', 'ok');
  };

  return (
    <section className="card">
      <header className="card-h">
        <Icon name="lens" />
        <h3>Face lock (Face ID style)</h3>
        <span className="card-src">{enabled ? 'On' : 'Off'}</span>
      </header>
      <p className="muted small">
        Unlocks when you look at the camera and blink once; the PIN always works as a fallback. A regular webcam has no depth sensor, so this is a personal lock against casual access, not security on the level of Apple’s Face ID.
      </p>

      <div className="seg-row">
        <span>Backup PIN</span>
        <input className="pin-input" type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} placeholder={pinHash ? '•••• (set)' : '4 to 8 digits'} dir="ltr" />
        <button className="btn" onClick={savePin}>
          Save PIN
        </button>
      </div>

      <div className="seg-row">
        <span>Face</span>
        <button className="btn primary" onClick={() => setMode('enroll')} disabled={mode !== 'idle'}>
          <Icon name="camera" size={18} /> {enrollment ? 'Enroll again' : 'Enroll face'}
        </button>
        {enrollment && (
          <>
            <button className="btn" onClick={() => setMode(mode === 'test' ? 'idle' : 'test')}>
              {mode === 'test' ? 'End test' : 'Test'}
            </button>
            <button className="btn" onClick={() => saveLock({ enrollment: null })}>
              Remove face
            </button>
          </>
        )}
      </div>

      {mode !== 'idle' && (
        <div className="face-enroll">
          <div className="face-cam">
            <video ref={video} muted playsInline />
            <canvas ref={canvas} width={320} height={240} />
            <div className="face-oval" />
          </div>
          {mode === 'enroll' && (
            <>
              <p>Slowly turn your head a little left, right, up and down…</p>
              <span className="bar">
                <span style={{ width: `${Math.round(progress * 100)}%` }} />
              </span>
            </>
          )}
          {mode === 'test' && enrollment && (
            <p dir="ltr" className={live !== null && live < enrollment.threshold ? 'match-ok' : 'match-no'}>
              score {live?.toFixed(3) ?? '—'} / threshold {enrollment.threshold.toFixed(3)} — {live !== null && live < enrollment.threshold ? 'MATCH' : 'no match'}
            </p>
          )}
        </div>
      )}

      {enrollment && (
        <div className="seg-row">
          <span>Sensitivity</span>
          <input
            type="range"
            min={0.02}
            max={0.12}
            step={0.002}
            value={enrollment.threshold}
            onChange={e => saveLock({ enrollment: { ...enrollment, threshold: Number(e.target.value) } })}
          />
          <small className="muted" dir="ltr">
            {enrollment.threshold.toFixed(3)} (lower = stricter)
          </small>
        </div>
      )}

      <label className="check">
        <input type="checkbox" checked={enabled} disabled={!pinHash} onChange={e => saveLock({ enabled: e.target.checked })} />
        Lock when Vision OS opens {!pinHash && '(set a backup PIN first)'}
      </label>
      {enabled && (
        <button className="btn" onClick={() => lockNow()}>
          Lock now (Ctrl+Alt+L)
        </button>
      )}
    </section>
  );
}
