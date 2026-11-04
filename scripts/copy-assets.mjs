// Copies runtime assets that must be served locally (offline-first): the MediaPipe WASM
// runtime and the pdf.js worker, cmaps and fonts.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');

function copy(from, to) {
  if (!existsSync(from)) {
    console.warn(`[copy-assets] missing: ${from}`);
    return;
  }
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log(`[copy-assets] ${to.replace(root, '.')}`);
}

copy(join(root, 'node_modules/@mediapipe/tasks-vision/wasm'), join(pub, 'mediapipe/wasm'));

// The hand and face landmark models (Google MediaPipe, Apache-2.0) are kept in public/models.
for (const name of ['hand_landmarker.task', 'face_landmarker.task']) {
  if (!existsSync(join(pub, 'models', name))) console.warn(`[copy-assets] missing: public/models/${name}`);
}

copy(join(root, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'), join(pub, 'pdfjs/pdf.worker.min.mjs'));
copy(join(root, 'node_modules/pdfjs-dist/cmaps'), join(pub, 'pdfjs/cmaps'));
copy(join(root, 'node_modules/pdfjs-dist/standard_fonts'), join(pub, 'pdfjs/standard_fonts'));
