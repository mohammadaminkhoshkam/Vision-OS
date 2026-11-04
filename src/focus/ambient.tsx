// Ambient sounds (FG-06) synthesised with WebAudio: no recordings, nothing to license, offline.
import { useState } from 'react';

type Kind = 'rain' | 'wind' | 'stream' | 'birds';
const LABEL: Record<Kind, string> = { rain: 'Rain', wind: 'Wind', stream: 'Stream', birds: 'Birds' };

let ctx: AudioContext | null = null;
const nodes: Partial<Record<Kind, { gain: GainNode; stop: () => void }>> = {};

function noiseBuffer(c: AudioContext, brown = false) {
  const len = c.sampleRate * 3;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    d[i] = brown ? (last = (last + 0.02 * w) / 1.02) * 3.5 : w;
  }
  return buf;
}

function build(kind: Kind, c: AudioContext): { gain: GainNode; stop: () => void } {
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.connect(c.destination);
  if (kind === 'birds') {
    // short frequency-swept chirps at random intervals
    let alive = true;
    const chirp = () => {
      if (!alive) return;
      const o = c.createOscillator(), g = c.createGain();
      const t = c.currentTime, f = 2200 + Math.random() * 1800;
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * (1.3 + Math.random() * 0.5), t + 0.09);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o.connect(g).connect(gain);
      o.start(t);
      o.stop(t + 0.16);
      const twice = Math.random() < 0.5;
      setTimeout(chirp, twice ? 180 : 1200 + Math.random() * 4500);
    };
    chirp();
    return { gain, stop: () => (alive = false) };
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, kind !== 'rain');
  src.loop = true;
  const filter = c.createBiquadFilter();
  if (kind === 'rain') {
    filter.type = 'highpass';
    filter.frequency.value = 900;
  } else if (kind === 'stream') {
    filter.type = 'bandpass';
    filter.frequency.value = 700;
    filter.Q.value = 0.7;
  } else {
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    // slow gusts
    const lfo = c.createOscillator(), depth = c.createGain();
    lfo.frequency.value = 0.08;
    depth.gain.value = 300;
    lfo.connect(depth).connect(filter.frequency);
    lfo.start();
  }
  src.connect(filter).connect(gain);
  src.start();
  return { gain, stop: () => src.stop() };
}

function setLevel(kind: Kind, level: number) {
  if (level > 0 && !ctx) ctx = new AudioContext();
  if (!ctx) return;
  void ctx.resume();
  if (level > 0 && !nodes[kind]) nodes[kind] = build(kind, ctx);
  const n = nodes[kind];
  if (!n) return;
  n.gain.gain.setTargetAtTime(level * (kind === 'birds' ? 0.5 : 0.35), ctx.currentTime, 0.3);
  if (level === 0) {
    const k = kind;
    setTimeout(() => {
      if (nodes[k] && nodes[k]!.gain.gain.value < 0.01) {
        nodes[k]!.stop();
        nodes[k]!.gain.disconnect();
        delete nodes[k];
      }
    }, 1500);
  }
}

export function AmbientMixer() {
  // sounds start muted on every launch: audio only plays after the user asks for it
  const [levels, setLevels] = useState<Record<Kind, number>>({ rain: 0, wind: 0, stream: 0, birds: 0 });
  return (
    <div className="ambient">
      {(Object.keys(LABEL) as Kind[]).map(k => (
        <label key={k} className="slider">
          <span>{LABEL[k]}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={levels[k]}
            onChange={e => {
              const v = Number(e.target.value);
              setLevels(l => ({ ...l, [k]: v }));
              setLevel(k, v);
            }}
          />
        </label>
      ))}
      <button
        className="btn small"
        onClick={() => {
          (Object.keys(LABEL) as Kind[]).forEach(k => setLevel(k, 0));
          setLevels({ rain: 0, wind: 0, stream: 0, birds: 0 });
        }}
      >
        Mute
      </button>
    </div>
  );
}
