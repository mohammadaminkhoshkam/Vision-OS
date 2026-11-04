// Lock screen with face unlock (look + blink) and a PIN fallback. Large keys work with the
// mouse, keyboard and the hand cursor alike.
import { useEffect, useRef, useState } from 'react';
import { GardenScene } from '../garden/GardenScene';
import { app } from '../state/app';
import { BlinkDetector, hashPin, score, template } from './face';
import { lock, openFaceCam } from './lock';

type Phase = 'starting' | 'looking' | 'match' | 'nomatch' | 'ok' | 'nocam' | 'pin';

const STATUS: Record<Phase, string> = {
  starting: 'Preparing the camera…',
  looking: 'Look at the camera',
  match: 'Recognized; blink once',
  nomatch: 'Face does not match',
  ok: 'Welcome',
  nocam: 'Camera unavailable; enter your PIN',
  pin: 'Enter your PIN',
};

/** Apple-style face glyph: corner brackets + eyes, nose and smile; morphs to a check on success. */
export function FaceGlyph({ phase }: { phase: Phase }) {
  const ok = phase === 'ok';
  return (
    <svg className={`face-glyph ${phase}`} viewBox="0 0 100 100" width="112" height="112" aria-hidden>
      <g className="brackets" fill="none" strokeWidth="5" strokeLinecap="round">
        <path d="M8 30 V18 a10 10 0 0 1 10 -10 H30" />
        <path d="M70 8 H82 a10 10 0 0 1 10 10 V30" />
        <path d="M92 70 V82 a10 10 0 0 1 -10 10 H70" />
        <path d="M30 92 H18 a10 10 0 0 1 -10 -10 V70" />
      </g>
      {ok ? (
        <path className="check" d="M30 52 L44 66 L72 36" fill="none" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <g className="features" fill="none" strokeWidth="5" strokeLinecap="round">
          <path d="M34 34 V42" />
          <path d="M66 34 V42" />
          <path d="M50 34 V56 h-5" />
          <path d="M36 68 q14 10 28 0" />
        </g>
      )}
    </svg>
  );
}

function PinPad({ onDone, error }: { onDone: (pin: string) => void; error: string | null }) {
  const [pin, setPinState] = useState('');
  const ref = useRef(''); // fast typing can outrun re-renders, so the source of truth is a ref
  const setPin = (v: string) => {
    ref.current = v;
    setPinState(v);
  };
  const press = (k: string) => {
    const cur = ref.current;
    if (k === '⌫') return setPin(cur.slice(0, -1));
    if (k === '✓') {
      if (cur.length >= 4) onDone(cur);
      return setPin('');
    }
    if (cur.length < 8) setPin(cur + k);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('⌫');
      else if (e.key === 'Enter') press('✓');
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });
  return (
    <div className="pin">
      <div className={`pin-dots ${error ? 'shake' : ''}`} dir="ltr">
        {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
          <span key={i} className={i < pin.length ? 'on' : ''} />
        ))}
      </div>
      {error && <div className="pin-error">{error}</div>}
      <div className="pin-keys" dir="ltr">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'].map(k => (
          <button key={k} className={`pin-key ${k === '✓' ? 'go' : ''}`} onClick={() => press(k)}>
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LockScreen() {
  const { enrollment, pinHash } = lock.use(s => s);
  const night = app.use(s => s.theme === 'night');
  const [phase, setPhase] = useState<Phase>(enrollment ? 'starting' : 'pin');
  const [pinError, setPinError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const fails = useRef({ n: 0, until: 0 });

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(t);
  }, []);

  const unlock = () => {
    setPhase('ok');
    setTimeout(() => lock.set({ locked: false }), 650);
  };

  // face unlock: N consecutive matching frames + one blink
  useEffect(() => {
    if (!enrollment || phase === 'pin') return;
    let stop: (() => void) | null = null;
    let dead = false;
    const blink = new BlinkDetector();
    let streak = 0, misses = 0;
    openFaceCam(f => {
      if (dead) return;
      if (!f) {
        streak = 0;
        return setPhase(p => (p === 'ok' ? p : 'looking'));
      }
      const s = score(enrollment, template(f.lm, f.aspect));
      if (s < enrollment.threshold) {
        streak++;
        misses = 0;
        if (streak >= 4) {
          setPhase(p => (p === 'ok' ? p : 'match'));
          if (blink.update(f.blinkL, f.blinkR, f.t)) {
            dead = true;
            stop?.();
            unlock();
          }
        }
      } else {
        streak = 0;
        blink.reset();
        if (++misses > 25) setPhase(p => (p === 'ok' ? p : 'nomatch'));
      }
    })
      .then(s => {
        stop = s;
        if (dead) s();
        else setPhase(p => (p === 'starting' ? 'looking' : p));
      })
      .catch(() => setPhase('nocam'));
    return () => {
      dead = true;
      stop?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollment, phase === 'pin']);

  const tryPin = async (pin: string) => {
    if (Date.now() < fails.current.until) return setPinError('Please wait a moment');
    if ((await hashPin(pin)) === pinHash) return unlock();
    fails.current.n++;
    if (fails.current.n >= 5) {
      fails.current = { n: 0, until: Date.now() + 30000 };
      setPinError('Wrong PIN; wait 30 seconds');
    } else setPinError('Wrong PIN');
  };

  const showPin = phase === 'pin' || phase === 'nocam' || phase === 'nomatch';
  return (
    <div className={`lock ${phase === 'ok' ? 'leaving' : ''}`}>
      <div className="lock-bg">
        <GardenScene night={night} dim={0} />
      </div>
      <div className="lock-center">
        <div className="lock-time">{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
        <div className="lock-date">{now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <div className="lock-card">
          <FaceGlyph phase={phase} />
          <div className="lock-status">{STATUS[phase]}</div>
          {showPin && pinHash && <PinPad onDone={tryPin} error={pinError} />}
          <div className="lock-actions">
            {enrollment && showPin && (
              <button className="lock-link" onClick={() => setPhase('starting')}>
                Try face again
              </button>
            )}
            {!showPin && pinHash && (
              <button className="lock-link" onClick={() => setPhase('pin')}>
                Use PIN
              </button>
            )}
          </div>
        </div>
        <p className="lock-note">Face processing happens only on this computer, and no images are stored.</p>
      </div>
    </div>
  );
}
