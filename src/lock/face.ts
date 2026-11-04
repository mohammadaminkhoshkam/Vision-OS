// Face template matching for the optional lock screen.
//
// Honest scope: this compares the *geometry* of rigid face landmarks from a normal webcam. It is
// a convenience lock to keep casual users out, not a biometric security system — there is no
// depth sensor like Apple's Face ID. A blink is required (simple liveness check against a photo)
// and a PIN always works as a fallback. Only numbers are stored, never an image.

export type P3 = { x: number; y: number; z: number };

/** Rigid MediaPipe face-mesh points (eye corners, nose, brows, cheeks, jaw, chin). Mouth is excluded: it moves with expression. */
export const KEY_POINTS = [33, 133, 263, 362, 1, 4, 6, 168, 98, 327, 152, 10, 234, 454, 172, 397, 70, 300, 105, 334, 199, 93, 323];
const R_EYE_OUT = 33, L_EYE_OUT = 263;

/**
 * Pairwise distances between key points, scaled by the distance between the outer eye corners.
 * Invariant to position, in-plane rotation and distance from the camera.
 * `aspect` = video width / height (landmark x and y are normalized separately).
 */
export function template(lm: P3[], aspect: number): number[] {
  const pt = (i: number) => ({ x: lm[i].x * aspect, y: lm[i].y, z: lm[i].z * aspect });
  const d = (a: ReturnType<typeof pt>, b: ReturnType<typeof pt>) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const io = d(pt(R_EYE_OUT), pt(L_EYE_OUT)) || 1e-6;
  const pts = KEY_POINTS.map(pt);
  const out: number[] = [];
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) out.push(d(pts[i], pts[j]) / io);
  return out;
}

/** Relative mean absolute difference between two templates (0 = identical). */
export function distance(a: number[], b: number[]): number {
  let num = 0, den = 0;
  for (let i = 0; i < a.length; i++) {
    num += Math.abs(a[i] - b[i]);
    den += (a[i] + b[i]) / 2;
  }
  return den ? num / den : 1;
}

export function average(ts: number[][]): number[] {
  const out = new Array(ts[0].length).fill(0);
  for (const t of ts) for (let i = 0; i < t.length; i++) out[i] += t[i] / ts.length;
  return out;
}

export interface Enrollment {
  templates: number[][];
  threshold: number;
  created: string;
}

/**
 * Build an enrollment from samples taken while the user turns slightly. Samples are grouped into
 * a few poses; the threshold is set from how much the user's own samples vary.
 */
export function enroll(samples: number[][], groups = 4): Enrollment {
  if (samples.length < groups * 3) throw new Error('not enough samples');
  const size = Math.floor(samples.length / groups);
  const templates = Array.from({ length: groups }, (_, g) => average(samples.slice(g * size, (g + 1) * size)));
  const spread = samples.map(s => Math.min(...templates.map(t => distance(s, t))));
  spread.sort((a, b) => a - b);
  const p90 = spread[Math.floor(spread.length * 0.9)];
  return { templates, threshold: Math.min(0.09, Math.max(0.035, p90 * 1.8)), created: new Date().toISOString() };
}

export function score(e: Enrollment, t: number[]): number {
  return Math.min(...e.templates.map(x => distance(x, t)));
}

/** Blink detector over blendshape scores: eyes clearly closed, then clearly open again. */
export class BlinkDetector {
  private closedAt: number | null = null;
  blinked = false;
  update(blinkL: number, blinkR: number, t: number) {
    const closed = (blinkL + blinkR) / 2;
    if (closed > 0.55) this.closedAt ??= t;
    else if (closed < 0.25 && this.closedAt !== null) {
      if (t - this.closedAt < 700) this.blinked = true;
      this.closedAt = null;
    }
    return this.blinked;
  }
  reset() {
    this.closedAt = null;
    this.blinked = false;
  }
}

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`vision-os:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
