export type VisionState = 'CAMERA_OFF' | 'STANDBY' | 'ACTIVE' | 'PAUSED' | 'CALIBRATING';
export type Side = 'Left' | 'Right';
export type Pose = 'fist' | 'open' | 'point' | 'vsign' | 'pinch' | 'other';
export type Point = { x: number; y: number };

/** One detected hand, already reduced to the features the state machine needs. */
export interface HandFrame {
  side: Side;
  /** thumb, index, middle, ring, pinky */
  fingers: [boolean, boolean, boolean, boolean, boolean];
  /** thumb-tip ↔ index-tip distance divided by hand size (scale invariant) */
  pinchRatio: number;
  /** pointer anchor (index knuckle), camera-normalized and mirrored so moving right = +x */
  anchor: Point;
  /** palm centre, mirrored */
  palm: Point;
  size: number;
  score: number;
}

export interface Frame {
  t: number;
  hands: HandFrame[];
}

export type SwipeDir = 'left' | 'right' | 'up' | 'down';

export type VisionEvent =
  | { type: 'STATE'; state: VisionState; prev: VisionState; reason: string }
  | { type: 'HAND_FOUND' }
  | { type: 'HAND_LOST' }
  | { type: 'POINTER_MOVE'; x: number; y: number; confidence: number }
  | { type: 'PINCH_START'; x: number; y: number }
  | { type: 'PINCH_END' }
  | { type: 'CLICK'; x: number; y: number }
  | { type: 'DOUBLE_CLICK'; x: number; y: number }
  | { type: 'DRAG_START'; x: number; y: number }
  | { type: 'DRAG_MOVE'; x: number; y: number }
  | { type: 'DRAG_END'; x: number; y: number }
  | { type: 'SCROLL'; dy: number }
  | { type: 'SWIPE'; dir: SwipeDir }
  | { type: 'ZOOM'; scale: number }
  | { type: 'MENU_OPEN'; x: number; y: number }
  | { type: 'MENU_CLOSE' }
  | { type: 'MODE'; mode: GestureMode };

export type GestureMode = 'idle' | 'pointer' | 'drag' | 'scroll' | 'zoom' | 'menu';

export interface VisionSettings {
  dominant: Side;
  /** active camera region mapped to the whole screen */
  box: { x0: number; y0: number; x1: number; y1: number };
  pinchEnter: number;
  pinchExit: number;
  confirmFrames: number;
  activateHoldMs: number;
  activateWindowMs: number;
  guardMs: number;
  pauseAfterMs: number;
  resumeAfterMs: number;
  clickMaxMs: number;
  clickLookbackMs: number;
  dragThreshold: number;
  scrollGain: number;
  scrollDeadzone: number;
  swipeVelocity: number;
  swipeMinDist: number;
  swipeCooldownMs: number;
  menuHoldMs: number;
  minCutoff: number;
  beta: number;
  /** when false any visible hand activates control (no fist→open sequence) */
  requireActivationGesture: boolean;
}

export const defaultSettings: VisionSettings = {
  dominant: 'Right',
  box: { x0: 0.22, y0: 0.18, x1: 0.78, y1: 0.72 },
  pinchEnter: 0.3,
  pinchExit: 0.43,
  confirmFrames: 2,
  activateHoldMs: 250,
  activateWindowMs: 1600,
  guardMs: 600,
  pauseAfterMs: 700,
  resumeAfterMs: 350,
  clickMaxMs: 380,
  clickLookbackMs: 100,
  dragThreshold: 0.03,
  scrollGain: 2.4,
  scrollDeadzone: 0.004,
  swipeVelocity: 1.5,
  swipeMinDist: 0.16,
  swipeCooldownMs: 750,
  menuHoldMs: 850,
  minCutoff: 1.0,
  beta: 6,
  requireActivationGesture: true,
};
