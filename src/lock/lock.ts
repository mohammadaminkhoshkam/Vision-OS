import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { createStore, loadJson, saveJson } from '../lib/store';
import type { Enrollment, P3 } from './face';

const KEY = 'vos.lock';

interface Saved {
  enabled: boolean;
  enrollment: Enrollment | null;
  pinHash: string | null;
}
const saved = loadJson<Saved>(KEY, { enabled: false, enrollment: null, pinHash: null });

export const lock = createStore({ ...saved, locked: saved.enabled && !!saved.pinHash });

export function saveLock(patch: Partial<Saved>) {
  lock.set(patch);
  const { enabled, enrollment, pinHash } = lock.get();
  saveJson(KEY, { enabled, enrollment, pinHash });
}

export const lockNow = () => lock.get().enabled && lock.get().pinHash && lock.set({ locked: true });

export interface FaceFrame {
  lm: P3[];
  blinkL: number;
  blinkR: number;
  aspect: number;
  t: number;
}

let landmarker: Promise<FaceLandmarker> | null = null;
function getLandmarker() {
  landmarker ??= FilesetResolver.forVisionTasks('/mediapipe/wasm').then(fs => {
    const make = (delegate: 'GPU' | 'CPU') =>
      FaceLandmarker.createFromOptions(fs, {
        baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.6,
        minFacePresenceConfidence: 0.6,
      });
    return make('GPU').catch(() => make('CPU'));
  });
  return landmarker;
}

/** Opens the camera only for face matching; returns a stop() that releases it. No frame is stored. */
export async function openFaceCam(onFrame: (f: FaceFrame | null) => void, video?: HTMLVideoElement): Promise<() => void> {
  const fl = await getLandmarker();
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false });
  const v = video ?? document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.srcObject = stream;
  await v.play();
  let raf = 0;
  let last = -1;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (v.readyState < 2 || v.currentTime === last) return;
    last = v.currentTime;
    const t = performance.now();
    const r = fl.detectForVideo(v, t);
    const lm = r.faceLandmarks[0];
    if (!lm) return onFrame(null);
    const cats = r.faceBlendshapes?.[0]?.categories ?? [];
    const bs = (n: string) => cats.find(c => c.categoryName === n)?.score ?? 0;
    onFrame({ lm: lm as P3[], blinkL: bs('eyeBlinkLeft'), blinkR: bs('eyeBlinkRight'), aspect: v.videoWidth / v.videoHeight || 4 / 3, t });
  };
  loop();
  return () => {
    cancelAnimationFrame(raf);
    stream.getTracks().forEach(tr => tr.stop());
    v.srcObject = null;
  };
}
