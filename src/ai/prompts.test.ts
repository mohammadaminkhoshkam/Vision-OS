import { describe, expect, it } from 'vitest';
import { buildMessages, toBlocks } from './prompts';
import { isVisionModel } from './ollama';

describe('prompts', () => {
  const g = { excerpt: 'The EFIM submatrix related to the RIS angle parameters is a zero matrix.', title: 'RIS-Aided Localization', page: 7 };

  it('grounds the answer, cites the page and forbids invented numbers', () => {
    const [sys, user] = buildMessages('explain', 'teacher', g, '');
    expect(sys.role).toBe('system');
    expect(sys.content).toContain('page 7');
    expect(sys.content).toContain('needs checking');
    expect(sys.content).toMatch(/Never invent numerical values/);
    expect(sys.content).toContain('Answer in English');
    expect(user.content).toContain('zero matrix');
    expect(user.content).toContain('Task: Explain');
  });

  it('includes the user question and the role', () => {
    const [sys, user] = buildMessages('ask', 'reviewer', g, 'Why is it zero?');
    expect(sys.content).toContain('peer reviewer');
    expect(user.content).toContain('User question: Why is it zero?');
  });

  it('describes attached figures without the excerpt', () => {
    const [, user] = buildMessages('explain', 'engineer', { excerpt: '', hasImage: true, title: 'Antenna paper', page: 3 }, '');
    expect(user.content).toContain('image of a figure');
    expect(user.content).not.toContain('Excerpt:');
  });

  it('truncates very long context', () => {
    const [, user] = buildMessages('summarize', 'teacher', { ...g, context: 'x'.repeat(20000) }, '');
    expect(user.content.length).toBeLessThan(5000);
  });
});

describe('helpers', () => {
  it('splits markdown into blocks', () => {
    expect(toBlocks('# Title\nPara\n- one\n2) two')).toEqual([
      { kind: 'h', text: 'Title' },
      { kind: 'p', text: 'Para' },
      { kind: 'li', text: 'one' },
      { kind: 'li', text: 'two' },
    ]);
  });

  it('recognises vision models', () => {
    expect(isVisionModel('gemma3:4b')).toBe(true);
    expect(isVisionModel('llava:7b')).toBe(true);
    expect(isVisionModel('qwen2.5:7b')).toBe(false);
  });
});
