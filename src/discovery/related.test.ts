import { describe, expect, it } from 'vitest';
import { relatedTo, relations, tokens } from './related';

const docs = [
  { id: 'meta', text: 'Beam steering with metasurfaces. Phase gradient metasurface steers the reflected beam. Reconfigurable surface.' },
  { id: 'ris', text: 'Reconfigurable intelligent surfaces reshape mmWave channels; the metasurface phase is tuned to steer the beam.' },
  { id: 'gan', text: 'Diffusion models beat GANs on image synthesis with classifier guidance.' },
  { id: 'attn', text: 'Attention is all you need: the transformer replaces recurrence with attention for translation.' },
];

describe('related papers', () => {
  it('normalises words and drops stop words', () => {
    expect(tokens('The Beams are steering surfaces')).toEqual(['beam', 'steer', 'surfac']);
  });
  it('links papers that share meaningful terms and explains why', () => {
    const rels = relations(docs);
    const r = relatedTo(rels, 'meta');
    expect(r[0].id).toBe('ris');
    expect(r[0].terms).toEqual(expect.arrayContaining(['metasurface', 'beam']));
    expect(relatedTo(rels, 'gan').some(x => x.id === 'meta')).toBe(false);
  });
  it('can blend in local embeddings', () => {
    const embed = new Map([['gan', [1, 0]], ['attn', [0.98, 0.2]], ['meta', [0, 1]], ['ris', [0.1, 1]]]);
    expect(relatedTo(relations(docs, { embed }), 'gan').map(x => x.id)).toContain('attn');
  });
  it('caps links per paper', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ id: `d${i}`, text: `antenna array beam calibration topic${i}` }));
    const rels = relations(many, { perDoc: 2 });
    for (const d of many) expect(relatedTo(rels, d.id).length).toBeLessThanOrEqual(2);
  });
});
