// Deterministic gesture state machine. Pure: time comes in with each frame, events come out.
// Safety rules (from the spec) live here, not in the UI:
//  - control only turns on via two fists → two open palms (or an explicit button/shortcut)
//  - hands down / out of frame → PAUSED, and any drag in progress is released
//  - a guard interval after activation/resume so the activating motion never clicks
//  - a hand that enters already pinched never clicks until it releases once
import { OneEuro2D } from './filters';
import type { Frame, GestureMode, HandFrame, Point, Pose, Side, VisionEvent, VisionSettings, VisionState } from './types';
import { defaultSettings } from './types';

interface HandTrack {
  rawPose: Pose;
  rawCount: number;
  pose: Pose;
  pinching: boolean;
  pinchCount: number;
  /** entered the frame already pinched → ignore until first release */
  pinchBlocked: boolean;
}

const BOTTOM_EDGE = 0.96;
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export class GestureMachine {
  state: VisionState = 'CAMERA_OFF';
  mode: GestureMode = 'idle';
  settings: VisionSettings;
  pointer: Point = { x: 0.5, y: 0.5 };

  private tracks = new Map<Side, HandTrack>();
  private filter: OneEuro2D;
  private history: { t: number; p: Point }[] = [];
  private armedAt: number | null = null;
  private fistSince: number | null = null;
  private deactArmedAt: number | null = null;
  private guardUntil = 0;
  private lostSince: number | null = null;
  private seenSince: number | null = null;
  private handCount = 0;
  private pinch: { t: number; at: Point; dragging: boolean } | null = null;
  private lastClick: { t: number; at: Point } | null = null;
  private scrollPrevY: number | null = null;
  private palmTrail: { t: number; x: number; y: number }[] = [];
  private swipeCooldownUntil = 0;
  private openSince: number | null = null;
  private menuOpen = false;
  private zoomPrev: number | null = null;

  constructor(settings: Partial<VisionSettings> = {}) {
    this.settings = { ...defaultSettings, ...settings };
    this.filter = new OneEuro2D(this.settings.minCutoff, this.settings.beta);
  }

  configure(patch: Partial<VisionSettings>) {
    this.settings = { ...this.settings, ...patch };
    this.filter.tune(this.settings.minCutoff, this.settings.beta);
  }

  /** Explicit state change from UI (buttons, shortcuts, kill switch). */
  setState(next: VisionState, reason: string, t = performance.now()): VisionEvent[] {
    if (next === this.state) return [];
    const out: VisionEvent[] = [];
    this.releaseAll(out);
    const prev = this.state;
    this.state = next;
    this.armedAt = this.fistSince = this.deactArmedAt = null;
    this.lostSince = this.seenSince = null;
    if (next === 'ACTIVE') {
      this.guardUntil = t + this.settings.guardMs;
      for (const tr of this.tracks.values()) tr.pinchBlocked = tr.pinching;
    }
    out.push({ type: 'STATE', state: next, prev, reason });
    return out;
  }

  poseOf(side: Side): Pose | null {
    return this.tracks.get(side)?.pose ?? null;
  }

  update(frame: Frame): VisionEvent[] {
    const out: VisionEvent[] = [];
    const { t } = frame;
    const hands = frame.hands.filter(h => h.palm.y < BOTTOM_EDGE);
    this.updateTracks(hands);

    if (hands.length > 0 && this.handCount === 0) out.push({ type: 'HAND_FOUND' });
    if (hands.length === 0 && this.handCount > 0) out.push({ type: 'HAND_LOST' });
    this.handCount = hands.length;

    switch (this.state) {
      case 'STANDBY':
        this.standby(hands, t, out);
        break;
      case 'PAUSED':
        if (hands.length > 0) {
          this.seenSince ??= t;
          if (t - this.seenSince >= this.settings.resumeAfterMs) out.push(...this.setState('ACTIVE', 'hand returned', t));
        } else this.seenSince = null;
        break;
      case 'ACTIVE':
        this.active(hands, t, out);
        break;
      default:
        break;
    }
    return out;
  }

  // ───────────────────────────────── internals

  private updateTracks(hands: HandFrame[]) {
    const s = this.settings;
    const seen = new Set<Side>();
    for (const h of hands) {
      seen.add(h.side);
      let tr = this.tracks.get(h.side);
      const fresh = !tr;
      if (!tr) {
        tr = { rawPose: 'other', rawCount: 0, pose: 'other', pinching: false, pinchCount: 0, pinchBlocked: false };
        this.tracks.set(h.side, tr);
      }
      // pinch with hysteresis + multi-frame confirmation
      const want = tr.pinching ? h.pinchRatio < s.pinchExit : h.pinchRatio < s.pinchEnter;
      if (want !== tr.pinching) {
        tr.pinchCount++;
        if (tr.pinchCount >= s.confirmFrames || fresh) {
          tr.pinching = want;
          tr.pinchCount = 0;
          if (fresh && want) tr.pinchBlocked = true;
          if (!want) tr.pinchBlocked = false;
        }
      } else tr.pinchCount = 0;

      const raw = classify(h, tr.pinching);
      if (raw === tr.rawPose) tr.rawCount++;
      else {
        tr.rawPose = raw;
        tr.rawCount = 1;
      }
      if (tr.rawCount >= s.confirmFrames) tr.pose = raw;
    }
    for (const side of [...this.tracks.keys()]) if (!seen.has(side)) this.tracks.delete(side);
  }

  private bothAre(pose: Pose) {
    if (this.tracks.size !== 2) return false;
    for (const tr of this.tracks.values()) if (tr.pose !== pose) return false;
    return true;
  }

  private standby(hands: HandFrame[], t: number, out: VisionEvent[]) {
    const s = this.settings;
    if (!s.requireActivationGesture) {
      if (hands.length > 0) out.push(...this.setState('ACTIVE', 'hand seen', t));
      return;
    }
    if (this.bothAre('fist')) {
      this.fistSince ??= t;
      if (t - this.fistSince >= s.activateHoldMs) this.armedAt = t;
    } else this.fistSince = null;

    if (this.armedAt !== null) {
      if (t - this.armedAt > s.activateWindowMs) this.armedAt = null;
      else if (this.bothAre('open')) out.push(...this.setState('ACTIVE', 'two fists → open', t));
    }
  }

  private active(hands: HandFrame[], t: number, out: VisionEvent[]) {
    const s = this.settings;
    if (hands.length === 0) {
      this.lostSince ??= t;
      if (t - this.lostSince >= s.pauseAfterMs) out.push(...this.setState('PAUSED', 'hands down', t));
      else this.releaseAll(out); // never leave a drag hanging while the hand is gone
      return;
    }
    this.lostSince = null;

    // deactivation: two open palms → two fists
    if (this.bothAre('open')) this.deactArmedAt = t;
    if (this.deactArmedAt !== null) {
      if (t - this.deactArmedAt > s.activateWindowMs) this.deactArmedAt = null;
      else if (this.bothAre('fist')) {
        this.fistSince ??= t;
        if (t - this.fistSince >= s.activateHoldMs) {
          out.push(...this.setState('STANDBY', 'two open → fists', t));
          return;
        }
      } else this.fistSince = null;
    }

    const guarded = t < this.guardUntil;

    // two-hand zoom: both hands pinching
    if (hands.length === 2) {
      const [a, b] = hands;
      const ta = this.tracks.get(a.side)!, tb = this.tracks.get(b.side)!;
      if (ta.pinching && tb.pinching && !ta.pinchBlocked && !tb.pinchBlocked) {
        this.cancelPinch(out);
        this.setMode('zoom', out);
        const d = dist(a.palm, b.palm);
        if (this.zoomPrev !== null && !guarded) {
          const scale = d / this.zoomPrev;
          if (Math.abs(scale - 1) > 0.006) out.push({ type: 'ZOOM', scale });
        }
        this.zoomPrev = d;
        return;
      }
    }
    this.zoomPrev = null;

    const hand = this.pointerHand(hands);
    const tr = this.tracks.get(hand.side)!;

    // pointer (frozen in scroll pose and fist so those motions do not drag the cursor)
    if (tr.pose !== 'vsign' && tr.pose !== 'fist') {
      const b = s.box;
      const nx = clamp01((hand.anchor.x - b.x0) / (b.x1 - b.x0));
      const ny = clamp01((hand.anchor.y - b.y0) / (b.y1 - b.y0));
      this.pointer = this.filter.filter(nx, ny, t);
      this.history.push({ t, p: { ...this.pointer } });
      while (this.history.length && t - this.history[0].t > 400) this.history.shift();
      out.push({ type: 'POINTER_MOVE', x: this.pointer.x, y: this.pointer.y, confidence: hand.score });
    }
    if (guarded) return;

    // radial menu: open palm held still
    if (tr.pose === 'open' && !this.menuOpen) {
      const still = this.palmSpeed(t) < 0.35;
      if (still) {
        this.openSince ??= t;
        if (t - this.openSince >= s.menuHoldMs) {
          this.menuOpen = true;
          this.openSince = null;
          this.setMode('menu', out);
          out.push({ type: 'MENU_OPEN', x: this.pointer.x, y: this.pointer.y });
        }
      } else this.openSince = null;
    } else if (tr.pose !== 'open') this.openSince = null;
    if (this.menuOpen && tr.pose === 'fist') this.closeMenu(out);

    // swipe: fast horizontal open-palm motion
    this.palmTrail.push({ t, x: hand.palm.x, y: hand.palm.y });
    while (this.palmTrail.length && t - this.palmTrail[0].t > 220) this.palmTrail.shift();
    if (tr.pose === 'open' && !this.menuOpen && t >= this.swipeCooldownUntil && this.palmTrail.length >= 3) {
      const first = this.palmTrail[0];
      const dx = hand.palm.x - first.x;
      const dt = Math.max(1, t - first.t) / 1000;
      if (Math.abs(dx) >= s.swipeMinDist && Math.abs(dx) / dt >= s.swipeVelocity) {
        out.push({ type: 'SWIPE', dir: dx > 0 ? 'right' : 'left' });
        this.swipeCooldownUntil = t + s.swipeCooldownMs;
        this.openSince = null;
        this.palmTrail = [];
      }
    }

    // scroll: V sign + vertical motion
    if (tr.pose === 'vsign') {
      this.setMode('scroll', out);
      if (this.scrollPrevY !== null) {
        const dy = (hand.palm.y - this.scrollPrevY) * s.scrollGain;
        if (Math.abs(dy) > s.scrollDeadzone) out.push({ type: 'SCROLL', dy });
      }
      this.scrollPrevY = hand.palm.y;
    } else this.scrollPrevY = null;

    // pinch → click / drag
    if (tr.pinching && !tr.pinchBlocked) {
      if (!this.pinch) {
        const at = this.pointerAt(t - s.clickLookbackMs);
        this.pinch = { t, at, dragging: false };
        out.push({ type: 'PINCH_START', x: at.x, y: at.y });
      } else {
        const moved = dist(this.pointer, this.pinch.at);
        if (!this.pinch.dragging && (moved > s.dragThreshold || t - this.pinch.t > s.clickMaxMs)) {
          this.pinch.dragging = true;
          this.setMode('drag', out);
          out.push({ type: 'DRAG_START', x: this.pinch.at.x, y: this.pinch.at.y });
        }
        if (this.pinch.dragging) out.push({ type: 'DRAG_MOVE', x: this.pointer.x, y: this.pointer.y });
      }
    } else if (this.pinch) {
      const p = this.pinch;
      this.pinch = null;
      if (p.dragging) out.push({ type: 'DRAG_END', x: this.pointer.x, y: this.pointer.y });
      else {
        out.push({ type: 'CLICK', x: p.at.x, y: p.at.y });
        if (this.lastClick && t - this.lastClick.t < 450 && dist(this.lastClick.at, p.at) < 0.03) {
          out.push({ type: 'DOUBLE_CLICK', x: p.at.x, y: p.at.y });
          this.lastClick = null;
        } else this.lastClick = { t, at: p.at };
        if (this.menuOpen) this.closeMenu(out);
      }
      out.push({ type: 'PINCH_END' });
    }

    if (!this.pinch && tr.pose !== 'vsign' && !this.menuOpen) this.setMode('pointer', out);
  }

  private pointerHand(hands: HandFrame[]): HandFrame {
    if (hands.length === 1) return hands[0];
    return hands.find(h => h.side === this.settings.dominant) ?? hands[0];
  }

  private pointerAt(t: number): Point {
    for (let i = this.history.length - 1; i >= 0; i--) if (this.history[i].t <= t) return { ...this.history[i].p };
    return { ...this.pointer };
  }

  private palmSpeed(t: number) {
    const tr = this.palmTrail;
    if (tr.length < 2) return 0;
    const a = tr[0], b = tr[tr.length - 1];
    return Math.hypot(b.x - a.x, b.y - a.y) / Math.max(0.001, (t - a.t) / 1000);
  }

  private setMode(mode: GestureMode, out: VisionEvent[]) {
    if (mode !== this.mode) {
      this.mode = mode;
      out.push({ type: 'MODE', mode });
    }
  }

  private closeMenu(out: VisionEvent[]) {
    if (!this.menuOpen) return;
    this.menuOpen = false;
    out.push({ type: 'MENU_CLOSE' });
  }

  private cancelPinch(out: VisionEvent[]) {
    if (!this.pinch) return;
    if (this.pinch.dragging) out.push({ type: 'DRAG_END', x: this.pointer.x, y: this.pointer.y });
    out.push({ type: 'PINCH_END' });
    this.pinch = null;
  }

  private releaseAll(out: VisionEvent[]) {
    this.cancelPinch(out);
    this.closeMenu(out);
    this.scrollPrevY = null;
    this.zoomPrev = null;
    this.openSince = null;
    this.palmTrail = [];
    this.filter.reset();
    this.history = [];
    this.setMode('idle', out);
  }
}

export function classify(h: HandFrame, pinching: boolean): Pose {
  if (pinching) return 'pinch';
  const [, i, m, r, p] = h.fingers;
  if (!i && !m && !r && !p) return 'fist';
  if (i && m && r && p) return 'open';
  if (i && !m && !r && !p) return 'point';
  if (i && m && !r && !p) return 'vsign';
  return 'other';
}
