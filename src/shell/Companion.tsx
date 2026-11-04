// Optional companion (FG-08; idea from BongoCat / OpenPets): a small bird perched on the
// branch dock. Off by default, never speaks or pops up — it only reacts with gentle motion:
// hops when hand control turns on, flaps when a focus session earns dew, looks at the cursor.
import { useEffect, useRef, useState } from 'react';
import { focus } from '../focus/store';
import { app } from '../state/app';
import { vision } from '../vision/engine';

export function Companion() {
  const on = app.use(s => s.companion);
  const screen = app.use(s => s.screen);
  const reward = focus.use(s => s.lastReward);
  const [mood, setMood] = useState<'idle' | 'hop' | 'flap'>('idle');
  const [look, setLook] = useState(0);
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!on) return;
    const off = vision.on(e => {
      if (e.type === 'STATE' && e.state === 'ACTIVE') setMood('hop');
      if (e.type === 'POINTER_MOVE' && el.current) {
        const r = el.current.getBoundingClientRect();
        setLook(Math.max(-1, Math.min(1, (e.x * innerWidth - (r.left + r.width / 2)) / 400)));
      }
    });
    const onMove = (ev: MouseEvent) => {
      if (!el.current) return;
      const r = el.current.getBoundingClientRect();
      setLook(Math.max(-1, Math.min(1, (ev.clientX - (r.left + r.width / 2)) / 400)));
    };
    addEventListener('mousemove', onMove);
    return () => {
      off();
      removeEventListener('mousemove', onMove);
    };
  }, [on]);

  useEffect(() => {
    if (on && reward) setMood('flap');
  }, [on, reward]);

  useEffect(() => {
    if (mood === 'idle') return;
    const t = setTimeout(() => setMood('idle'), 1400);
    return () => clearTimeout(t);
  }, [mood]);

  if (!on || screen === 'reader' || screen === 'cinema' || screen === 'board') return null;
  return (
    <div ref={el} className={`companion ${mood}`} aria-hidden>
      <svg viewBox="-30 -34 60 50" width="58" height="48">
        <g className="bird" transform={`scale(${look < 0 ? -1 : 1} 1)`}>
          <path d="M-20,4 Q-26,-2 -30,2 Q-24,6 -18,8 Z" fill="#2b2418" />
          <ellipse cx="-2" cy="0" rx="18" ry="13" fill="#5a4630" />
          <ellipse cx="2" cy="5" rx="11" ry="8" fill="#c98a4a" />
          <path className="wing" d="M-10,-4 Q-2,-10 8,-2 Q-2,6 -12,4 Z" fill="#3a2c1c" />
          <circle cx="12" cy="-10" r="9" fill="#5a4630" />
          <circle cx={14 + look * 1.5} cy="-12" r="2.2" fill="#0d0a06" />
          <circle cx={14.6 + look * 1.5} cy="-12.6" r="0.7" fill="#fff" />
          <path d="M20,-10 L27,-8 L20,-6 Z" fill="#d6b46a" />
          <path d="M-4,12 v5 M3,12 v5" stroke="#2b2418" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}
