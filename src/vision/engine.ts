// Camera + MediaPipe Hand Landmarker → GestureMachine → events.
// No frame is stored or sent anywhere; only landmark features leave this module.
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { createStore, loadJson, saveJson } from '../lib/store';
import { toHandFrame, type Landmark } from './hands';
import { GestureMachine } from './machine';
import type { GestureMode, HandFrame, Side, VisionEvent, VisionSettings, VisionState } from './types';
import { defaultSettings } from './types';

const SETTINGS_KEY = 'vos.vision.settings';

export interface VisionStatus {
  state: VisionState;
  mode: GestureMode;
  fps: number;
  hands: number;
  quality: number;
  error: string | null;
  loading: boolean;
  settings: VisionSettings;
}

export const visionStatus = createStore<VisionStatus>({
  state: 'CAMERA_OFF',
  mode: 'idle',
  fps: 0,
  hands: 0,
  quality: 0,
  error: null,
  loading: false,
  settings: loadJson(SETTINGS_KEY, defaultSettings),
});

type Listener = (e: VisionEvent) => void;

class VisionEngine {
  readonly machine = new GestureMachine(visionStatus.get().settings);
  readonly video = document.createElement('video');
  /** latest raw landmarks, for the calibration preview only */
  lastLandmarks: { lm: Landmark[]; side: Side }[] = [];
  lastHands: HandFrame[] = [];
  private landmarker: HandLandmarker | null = null;
  private stream: MediaStream | null = null;
  private raf = 0;
  private lastVideoTime = -1;
  private frameTimes: number[] = [];
  private listeners = new Set<Listener>();
  private tick = 0;

  constructor() {
    this.video.muted = true;
    this.video.playsInline = true;
  }

  on(fn: Listener) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  private emit(events: VisionEvent[]) {
    for (const e of events) {
      if (e.type === 'STATE') visionStatus.set({ state: e.state });
      if (e.type === 'MODE') visionStatus.set({ mode: e.mode });
      this.listeners.forEach(fn => fn(e));
    }
  }

  configure(patch: Partial<VisionSettings>) {
    const settings = { ...visionStatus.get().settings, ...patch };
    this.machine.configure(settings);
    visionStatus.set({ settings });
    saveJson(SETTINGS_KEY, settings);
  }

  setState(next: VisionState, reason: string) {
    if (next === 'CAMERA_OFF') return this.stop();
    if (visionStatus.get().state === 'CAMERA_OFF') {
      void this.start().then(ok => ok && this.emit(this.machine.setState(next, reason)));
      return;
    }
    this.emit(this.machine.setState(next, reason));
  }

  async start(): Promise<boolean> {
    if (this.stream) return true;
    visionStatus.set({ loading: true, error: null });
    try {
      if (!this.landmarker) {
        const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
        const make = (delegate: 'GPU' | 'CPU') =>
          HandLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: '/models/hand_landmarker.task', delegate },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.6,
            minHandPresenceConfidence: 0.55,
            minTrackingConfidence: 0.5,
          });
        this.landmarker = await make('GPU').catch(() => make('CPU'));
      }
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user', frameRate: { ideal: 30 } },
        audio: false,
      });
      this.video.srcObject = this.stream;
      await this.video.play();
      this.emit(this.machine.setState('STANDBY', 'camera on'));
      visionStatus.set({ loading: false });
      this.loop();
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      visionStatus.set({ loading: false, error: msg });
      this.stop();
      return false;
    }
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach(t => t.stop()); // releases the camera: the LED goes off
    this.stream = null;
    this.video.srcObject = null;
    this.lastLandmarks = [];
    this.lastHands = [];
    this.emit(this.machine.setState('CAMERA_OFF', 'camera off'));
    visionStatus.set({ fps: 0, hands: 0, quality: 0 });
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const lm = this.landmarker;
    if (!lm || this.video.readyState < 2 || this.video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = this.video.currentTime;

    // STANDBY only watches for the activation sequence: process every other frame to save CPU
    const state = this.machine.state;
    this.tick++;
    if (state === 'STANDBY' && this.tick % 2) return;

    const now = performance.now();
    const res = lm.detectForVideo(this.video, now);
    const raw = res.landmarks.map((l, i) => ({
      lm: l as Landmark[],
      side: (res.handedness[i]?.[0]?.categoryName ?? 'Right') as Side,
      score: res.handedness[i]?.[0]?.score ?? 0,
    }));
    // MediaPipe occasionally labels both hands the same; fall back to screen position
    if (raw.length === 2 && raw[0].side === raw[1].side) {
      const [a, b] = raw;
      const aLeft = 1 - a.lm[0].x < 1 - b.lm[0].x;
      a.side = aLeft ? 'Left' : 'Right';
      b.side = aLeft ? 'Right' : 'Left';
    }
    this.lastLandmarks = raw;
    const hands = raw.map(r => toHandFrame(r.lm, r.side, r.score));
    this.lastHands = hands;
    this.emit(this.machine.update({ t: now, hands }));

    this.frameTimes.push(now);
    while (this.frameTimes.length && now - this.frameTimes[0] > 1000) this.frameTimes.shift();
    const quality = hands.length ? hands.reduce((s, h) => s + h.score, 0) / hands.length : 0;
    const prev = visionStatus.get();
    if (prev.hands !== hands.length || Math.abs(prev.fps - this.frameTimes.length) > 1 || Math.abs(prev.quality - quality) > 0.05)
      visionStatus.set({ fps: this.frameTimes.length, hands: hands.length, quality });
  };
}

export const vision = new VisionEngine();

// development only: lets automated UI tests replay gesture events without a camera
if (import.meta.env.DEV) Object.assign(globalThis, { __vosVision: vision });
