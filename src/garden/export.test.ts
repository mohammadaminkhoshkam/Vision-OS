// Exports the garden scene as standalone SVG for design tools (Figma). Runs only when OUT_DIR is set:
//   $env:OUT_DIR="..."; npx vitest run src/garden/export.test.ts
import { writeFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { it } from 'vitest';
import { GardenScene } from './GardenScene';

it.skipIf(!process.env.OUT_DIR)('exports the scene as SVG', () => {
  for (const night of [false, true]) {
    const html = renderToStaticMarkup(createElement(GardenScene, { night, dim: 0 }));
    let svg = html.slice(html.indexOf('<svg'), html.lastIndexOf('</svg>') + 6);
    svg = svg
      .replace(/ filter="url\(#(paint|glow|soft)\)"/g, '')
      .replace(/ style="[^"]*"/g, '')
      .replace(/ class="[^"]*"/g, '')
      .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" ');
    writeFileSync(`${process.env.OUT_DIR}/scene-${night ? 'night' : 'day'}.svg`, svg);
  }
});
