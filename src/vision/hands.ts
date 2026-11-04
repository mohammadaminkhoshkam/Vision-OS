import type { HandFrame, Side } from './types';

export type Landmark = { x: number; y: number; z?: number };

const dist = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);

// MediaPipe hand landmark indices
const WRIST = 0, THUMB_IP = 3, THUMB_TIP = 4, INDEX_MCP = 5, INDEX_PIP = 6, INDEX_TIP = 8;
const MIDDLE_MCP = 9, MIDDLE_PIP = 10, MIDDLE_TIP = 12, RING_PIP = 14, RING_TIP = 16;
const PINKY_MCP = 17, PINKY_PIP = 18, PINKY_TIP = 20;

/** A finger counts as extended when its tip is clearly farther from the wrist than its PIP joint. */
function extended(lm: Landmark[], tip: number, pip: number) {
  return dist(lm[tip], lm[WRIST]) > dist(lm[pip], lm[WRIST]) * 1.12;
}

/**
 * Reduce 21 landmarks to the features the gesture state machine uses.
 * Landmarks come from the un-mirrored camera frame; x is mirrored here so that moving the
 * hand to the user's right moves the pointer right.
 */
export function toHandFrame(lm: Landmark[], side: Side, score: number): HandFrame {
  const size = Math.max(1e-4, dist(lm[WRIST], lm[MIDDLE_MCP]));
  const thumbOut = dist(lm[THUMB_TIP], lm[PINKY_MCP]) > dist(lm[THUMB_IP], lm[PINKY_MCP]) * 1.05;
  const fingers: HandFrame['fingers'] = [
    thumbOut,
    extended(lm, INDEX_TIP, INDEX_PIP),
    extended(lm, MIDDLE_TIP, MIDDLE_PIP),
    extended(lm, RING_TIP, RING_PIP),
    extended(lm, PINKY_TIP, PINKY_PIP),
  ];
  const palmX = (lm[WRIST].x + lm[MIDDLE_MCP].x) / 2;
  const palmY = (lm[WRIST].y + lm[MIDDLE_MCP].y) / 2;
  return {
    side,
    fingers,
    pinchRatio: dist(lm[THUMB_TIP], lm[INDEX_TIP]) / size,
    anchor: { x: 1 - lm[INDEX_MCP].x, y: lm[INDEX_MCP].y },
    palm: { x: 1 - palmX, y: palmY },
    size,
    score,
  };
}
