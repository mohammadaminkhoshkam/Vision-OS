// One Euro filter (Casiez et al., CHI 2012): smooth when slow, responsive when fast.
// Adaptive by construction, which is what text selection vs. free pointer movement needs.

function alpha(cutoff: number, dt: number) {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

export class OneEuro {
  private x: number | null = null;
  private dx = 0;
  private t = 0;

  constructor(
    public minCutoff = 1.0,
    public beta = 6,
    public dCutoff = 1.0,
  ) {}

  reset() {
    this.x = null;
    this.dx = 0;
  }

  filter(value: number, tMs: number): number {
    if (this.x === null) {
      this.x = value;
      this.t = tMs;
      return value;
    }
    const dt = Math.max(1e-3, (tMs - this.t) / 1000);
    this.t = tMs;
    const rawDx = (value - this.x) / dt;
    this.dx += alpha(this.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }
}

export class OneEuro2D {
  readonly fx: OneEuro;
  readonly fy: OneEuro;
  constructor(minCutoff = 1.0, beta = 6) {
    this.fx = new OneEuro(minCutoff, beta);
    this.fy = new OneEuro(minCutoff, beta);
  }
  tune(minCutoff: number, beta: number) {
    this.fx.minCutoff = this.fy.minCutoff = minCutoff;
    this.fx.beta = this.fy.beta = beta;
  }
  reset() {
    this.fx.reset();
    this.fy.reset();
  }
  filter(x: number, y: number, t: number) {
    return { x: this.fx.filter(x, t), y: this.fy.filter(y, t) };
  }
}
