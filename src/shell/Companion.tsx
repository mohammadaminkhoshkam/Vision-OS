// Companion (FG-08; ideas from BongoCat, OpenPets and MewoOS's cat): a small bird beside the dock
// with a life of its own that still mirrors what you are really doing. It looks at the cursor and
// blinks, wanders a few steps and pecks now and then, settles down with closed eyes during a focus
// session, stretches when a break is due, falls asleep when nobody is at the computer, hops to greet
// you and flaps when a session is completed. Click it and it is happy; it remembers how often.
// It never speaks or pops up, and Reduced Motion keeps it still. Can be switched off in Settings.
import { useEffect, useRef, useState } from 'react';
import { loadJson, saveJson } from '../lib/store';
import { current, focus } from '../focus/store';
import { app } from '../state/app';
import { vision } from '../vision/engine';
import { baseMood, blinkDelay, fidgetDelay, greeting, idleFidget, TRANSIENT_MS, walkTarget, type Memory, type Mood } from './companionBrain';

const KEY = 'vos.companion';

export function Companion() {
  const on = app.use(s => s.companion);
  const screen = app.use(s => s.screen);
  const reduced = app.use(s => s.reducedMotion);
  const reward = focus.use(s => s.lastReward);
  const breakDue = focus.use(s => !!s.breakSuggestion);
  focus.use(s => s.sessions);
  const focusing = current()?.status === 'running';

  const mem = useRef<Memory>(loadJson<Memory>(KEY, { pets: 0, lastSeen: 0, celebrations: 0 }));
  const remember = (patch: Partial<Memory>) => {
    mem.current = { ...mem.current, ...patch };
    saveJson(KEY, mem.current);
  };

  const [transient, setTransient] = useState<Mood | null>(null);
  const [look, setLook] = useState(0);
  const [blink, setBlink] = useState(false);
  const [x, setX] = useState(0);
  const [lastInput, setLastInput] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const el = useRef<HTMLDivElement>(null);
  const prevScreen = useRef(screen);

  const play = (m: Mood) => setTransient(m);
  const base = baseMood({ now, lastInputAt: lastInput, focusing, breakDue });
  const mood: Mood = transient ?? base;
  const eyesClosed = blink || mood === 'rest' || mood === 'sleep';

  // greeting on launch (excited after a long absence), and remember that we met
  useEffect(() => {
    if (!on) return;
    const g = greeting(mem.current, Date.now());
    if (g) setTimeout(() => play(g), 900);
    remember({ lastSeen: Date.now() });
    const t = setInterval(() => remember({ lastSeen: Date.now() }), 60000);
    return () => clearInterval(t);
  }, [on]);

  // follow the cursor (mouse or hand) and notice that someone is there
  useEffect(() => {
    if (!on) return;
    const seen = (cx: number) => {
      setLastInput(Date.now());
      if (!el.current) return;
      const r = el.current.getBoundingClientRect();
      setLook(Math.max(-1, Math.min(1, (cx - (r.left + r.width / 2)) / 400)));
    };
    const off = vision.on(e => {
      if (e.type === 'STATE' && e.state === 'ACTIVE') play('hop');
      if (e.type === 'POINTER_MOVE') seen(e.x * innerWidth);
    });
    const onMove = (ev: MouseEvent) => seen(ev.clientX);
    const onKey = () => setLastInput(Date.now());
    addEventListener('mousemove', onMove);
    addEventListener('keydown', onKey);
    const tick = setInterval(() => setNow(Date.now()), 15000);
    return () => {
      off();
      removeEventListener('mousemove', onMove);
      removeEventListener('keydown', onKey);
      clearInterval(tick);
    };
  }, [on]);

  // woken up: a little hop
  const wasAsleep = useRef(false);
  useEffect(() => {
    if (wasAsleep.current && base !== 'sleep') play('hop');
    wasAsleep.current = base === 'sleep';
  }, [base]);

  // a completed focus session: flap, and remember it
  useEffect(() => {
    if (on && reward) {
      play('flap');
      remember({ celebrations: mem.current.celebrations + 1 });
    }
  }, [on, reward]);

  // welcome back to the garden from a work screen
  useEffect(() => {
    const from = prevScreen.current;
    prevScreen.current = screen;
    if (on && screen === 'home' && from !== 'home' && !focusing) play('hop');
  }, [on, screen, focusing]);

  // blinking
  useEffect(() => {
    if (!on || reduced) return;
    let t = 0;
    const next = () => {
      t = window.setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 140);
        next();
      }, blinkDelay(Math.random()));
    };
    next();
    return () => clearTimeout(t);
  }, [on, reduced]);

  // idle fidgets: a few steps along the branch, a peck
  useEffect(() => {
    if (!on || reduced || base !== 'idle') return;
    let t = 0;
    const next = () => {
      t = window.setTimeout(() => {
        const f = idleFidget(Math.random(), mem.current);
        if (f === 'walk') setX(v => walkTarget(v, Math.random()));
        if (f) play(f);
        next();
      }, fidgetDelay(Math.random()));
    };
    next();
    return () => clearTimeout(t);
  }, [on, reduced, base]);

  useEffect(() => {
    if (!transient) return;
    const t = setTimeout(() => setTransient(null), TRANSIENT_MS[transient] ?? 1200);
    return () => clearTimeout(t);
  }, [transient]);

  if (!on || screen === 'reader' || screen === 'cinema' || screen === 'board') return null;
  const facing = mood === 'walk' ? (x >= 0 ? 1 : -1) : look < 0 ? -1 : 1;
  const ex = 14 + (mood === 'idle' ? look * 1.5 : 0);
  return (
    <div ref={el} className={`companion ${mood}`} style={{ ['--cx' as string]: `${x}px` }}>
      <button
        className="companion-hit"
        aria-label="Pet the bird"
        title="Pet the bird"
        onClick={() => {
          setLastInput(Date.now());
          play('pet');
          remember({ pets: mem.current.pets + 1 });
        }}
      >
        <svg viewBox="-34 -46 68 66" width="64" height="62" aria-hidden>
          {mood === 'sleep' && (
            <text className="zzz" x="10" y="-30" fontSize="11" fill="#f1cd84" fontFamily="var(--font)" fontWeight="700">
              z
            </text>
          )}
          {mood === 'pet' && <path className="heart" d="M14,-30 c-3,-5 -10,-2 -7,4 l7,6 l7,-6 c3,-6 -4,-9 -7,-4z" fill="#e48aa2" />}
          <g className="bird" transform={`scale(${facing} 1)`}>
            <path d="M-20,4 Q-26,-2 -30,2 Q-24,6 -18,8 Z" fill="#2b2418" />
            <ellipse cx="-2" cy="0" rx="18" ry="13" fill="#5a4630" />
            <ellipse cx="2" cy="5" rx="11" ry="8" fill="#c98a4a" />
            <path className="wing" d={mood === 'stretch' ? 'M-10,-4 Q-20,-22 2,-16 Q-2,-4 -12,4 Z' : 'M-10,-4 Q-2,-10 8,-2 Q-2,6 -12,4 Z'} fill="#3a2c1c" />
            <g className="head">
              <circle cx="12" cy="-10" r="9" fill="#5a4630" />
              {eyesClosed ? (
                <path d={`M${ex - 2.5},-11.5 q2.5,1.6 5,0`} stroke="#0d0a06" strokeWidth="1.4" fill="none" strokeLinecap="round" />
              ) : (
                <>
                  <circle cx={ex} cy="-12" r="2.2" fill="#0d0a06" />
                  <circle cx={ex + 0.6} cy="-12.6" r="0.7" fill="#fff" />
                </>
              )}
              <path d="M20,-10 L27,-8 L20,-6 Z" fill="#d6b46a" />
            </g>
            <path className="legs" d="M-4,12 v5 M3,12 v5" stroke="#2b2418" strokeWidth="1.6" strokeLinecap="round" />
          </g>
        </svg>
      </button>
    </div>
  );
}
