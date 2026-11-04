import { describe, expect, it } from 'vitest';
import { GestureMachine } from './machine';
import type { Frame, HandFrame, Side, VisionEvent } from './types';

type Shape = 'fist' | 'open' | 'point' | 'vsign' | 'pinch';

function hand(side: Side, shape: Shape, x = 0.5, y = 0.45): HandFrame {
  const f: Record<Shape, HandFrame['fingers']> = {
    fist: [false, false, false, false, false],
    open: [true, true, true, true, true],
    point: [false, true, false, false, false],
    vsign: [false, true, true, false, false],
    pinch: [true, true, false, false, false],
  };
  return {
    side,
    fingers: f[shape],
    pinchRatio: shape === 'pinch' ? 0.1 : 0.9,
    anchor: { x, y },
    palm: { x, y: y + 0.05 },
    size: 0.1,
    score: 0.95,
  };
}

/** Drive the machine at 30 fps for `ms` with a constant set of hands. */
function run(m: GestureMachine, clock: { t: number }, ms: number, hands: () => HandFrame[]): VisionEvent[] {
  const out: VisionEvent[] = [];
  const end = clock.t + ms;
  while (clock.t < end) {
    clock.t += 33;
    out.push(...m.update({ t: clock.t, hands: hands() } as Frame));
  }
  return out;
}

function activated() {
  const m = new GestureMachine();
  const clock = { t: 0 };
  m.setState('STANDBY', 'test', 0);
  run(m, clock, 400, () => [hand('Left', 'fist', 0.3), hand('Right', 'fist', 0.7)]);
  run(m, clock, 200, () => [hand('Left', 'open', 0.3), hand('Right', 'open', 0.7)]);
  expect(m.state).toBe('ACTIVE');
  run(m, clock, 900, () => [hand('Right', 'point')]); // let the guard expire
  return { m, clock };
}

const types = (ev: VisionEvent[]) => ev.map(e => e.type);

describe('activation', () => {
  it('two fists then two open palms turns control on', () => {
    activated();
  });

  it('open palms alone do not activate', () => {
    const m = new GestureMachine();
    const clock = { t: 0 };
    m.setState('STANDBY', 'test', 0);
    run(m, clock, 1000, () => [hand('Left', 'open', 0.3), hand('Right', 'open', 0.7)]);
    expect(m.state).toBe('STANDBY');
  });

  it('the arming window expires', () => {
    const m = new GestureMachine();
    const clock = { t: 0 };
    m.setState('STANDBY', 'test', 0);
    run(m, clock, 400, () => [hand('Left', 'fist', 0.3), hand('Right', 'fist', 0.7)]);
    run(m, clock, 2500, () => []);
    run(m, clock, 200, () => [hand('Left', 'open', 0.3), hand('Right', 'open', 0.7)]);
    expect(m.state).toBe('STANDBY');
  });

  it('no clicks during the guard interval after activation', () => {
    const m = new GestureMachine();
    const clock = { t: 0 };
    m.setState('STANDBY', 'test', 0);
    run(m, clock, 400, () => [hand('Left', 'fist', 0.3), hand('Right', 'fist', 0.7)]);
    run(m, clock, 200, () => [hand('Left', 'open', 0.3), hand('Right', 'open', 0.7)]);
    const ev = [...run(m, clock, 100, () => [hand('Right', 'pinch')]), ...run(m, clock, 100, () => [hand('Right', 'point')])];
    expect(types(ev)).not.toContain('CLICK');
  });

  it('two open palms then two fists turns control off', () => {
    const { m, clock } = activated();
    run(m, clock, 200, () => [hand('Left', 'open', 0.3), hand('Right', 'open', 0.7)]);
    run(m, clock, 400, () => [hand('Left', 'fist', 0.3), hand('Right', 'fist', 0.7)]);
    expect(m.state).toBe('STANDBY');
  });
});

describe('pause', () => {
  it('hands down pauses and releases a drag', () => {
    const { m, clock } = activated();
    const ev = run(m, clock, 600, () => [hand('Right', 'pinch')]);
    expect(types(ev)).toContain('DRAG_START');
    const ev2 = run(m, clock, 900, () => []);
    expect(types(ev2)).toContain('DRAG_END');
    expect(m.state).toBe('PAUSED');
  });

  it('hand at the bottom edge counts as down', () => {
    const { m, clock } = activated();
    run(m, clock, 900, () => [hand('Right', 'point', 0.5, 0.97)]);
    expect(m.state).toBe('PAUSED');
  });

  it('returning hand resumes, but a hand entering pinched does not click', () => {
    const { m, clock } = activated();
    run(m, clock, 900, () => []);
    expect(m.state).toBe('PAUSED');
    const ev = run(m, clock, 1200, () => [hand('Right', 'pinch')]);
    expect(m.state).toBe('ACTIVE');
    const ev2 = run(m, clock, 200, () => [hand('Right', 'point')]);
    expect(types([...ev, ...ev2])).not.toContain('CLICK');
    expect(types([...ev, ...ev2])).not.toContain('DRAG_START');
  });
});

describe('pointer actions', () => {
  it('short pinch = click, long pinch = drag', () => {
    const { m, clock } = activated();
    const click = [...run(m, clock, 130, () => [hand('Right', 'pinch')]), ...run(m, clock, 130, () => [hand('Right', 'point')])];
    expect(types(click)).toContain('CLICK');
    expect(types(click)).not.toContain('DRAG_START');

    const drag = [...run(m, clock, 700, () => [hand('Right', 'pinch')]), ...run(m, clock, 130, () => [hand('Right', 'point')])];
    expect(types(drag)).toEqual(expect.arrayContaining(['DRAG_START', 'DRAG_MOVE', 'DRAG_END']));
    expect(types(drag)).not.toContain('CLICK');
  });

  it('V sign scrolls with vertical motion and freezes the pointer', () => {
    const { m, clock } = activated();
    let y = 0.3;
    const ev = run(m, clock, 500, () => [hand('Right', 'vsign', 0.5, (y += 0.02))]);
    const scrolls = ev.filter(e => e.type === 'SCROLL');
    expect(scrolls.length).toBeGreaterThan(3);
    // only the frames before the pose is confirmed may still move the pointer
    expect(ev.filter(e => e.type === 'POINTER_MOVE').length).toBeLessThanOrEqual(2);
  });

  it('fast open-palm motion swipes once (cooldown)', () => {
    const { m, clock } = activated();
    run(m, clock, 100, () => [hand('Right', 'open', 0.3)]);
    let x = 0.3;
    const ev = run(m, clock, 300, () => [hand('Right', 'open', (x += 0.06))]);
    expect(ev.filter(e => e.type === 'SWIPE')).toEqual([{ type: 'SWIPE', dir: 'right' }]);
  });

  it('two pinching hands zoom', () => {
    const { m, clock } = activated();
    let spread = 0.1;
    run(m, clock, 150, () => [hand('Left', 'point', 0.4), hand('Right', 'point', 0.6)]);
    const ev = run(m, clock, 500, () => {
      spread += 0.02;
      return [hand('Left', 'pinch', 0.5 - spread), hand('Right', 'pinch', 0.5 + spread)];
    });
    const zooms = ev.filter(e => e.type === 'ZOOM') as { scale: number }[];
    expect(zooms.length).toBeGreaterThan(3);
    expect(zooms.every(z => z.scale > 1)).toBe(true);
    expect(types(ev)).not.toContain('CLICK');
  });

  it('holding a still open palm opens the radial menu; fist closes it', () => {
    const { m, clock } = activated();
    const ev = run(m, clock, 1100, () => [hand('Right', 'open')]);
    expect(types(ev)).toContain('MENU_OPEN');
    const ev2 = run(m, clock, 200, () => [hand('Right', 'fist')]);
    expect(types(ev2)).toContain('MENU_CLOSE');
  });
});
