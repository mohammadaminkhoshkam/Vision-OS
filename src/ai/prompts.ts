// Prompt construction for the reading assistant. Pure, so it is unit tested.
// Rules baked into every prompt: stay grounded in the given excerpt, cite the page, flag
// uncertainty, never invent numbers or equations (spec SR-08, section 8.4).

export type Action = 'explain' | 'simplify' | 'expand' | 'summarize' | 'ask' | 'critique' | 'engineer';
export type Role = 'teacher' | 'reviewer' | 'engineer';

export const ACTIONS: { id: Action; label: string }[] = [
  { id: 'explain', label: 'Explain' },
  { id: 'simplify', label: 'Simplify' },
  { id: 'expand', label: 'Expand' },
  { id: 'summarize', label: 'Summarize' },
  { id: 'critique', label: 'Critique the method' },
  { id: 'engineer', label: 'Engineering use' },
];

export const ROLES: { id: Role; label: string; system: string }[] = [
  {
    id: 'teacher',
    label: 'Tutor',
    system: 'You are a patient teaching assistant for an electrical/telecommunications engineering researcher. Build intuition step by step, define symbols before using them, and use small concrete examples.',
  },
  {
    id: 'reviewer',
    label: 'Critical reviewer',
    system: 'You are a rigorous peer reviewer. Examine assumptions, methodology, baselines, data limits and threats to validity. Be specific and fair; separate what the text states from your assessment.',
  },
  {
    id: 'engineer',
    label: 'Engineering translator',
    system: 'You translate research into engineering practice for RF, DSP and wireless systems: practical implications, design trade-offs, suggested experiments or simulations (MATLAB/Python), and implementation steps. Mark these clearly as suggestions.',
  },
];

const TASK: Record<Action, string> = {
  explain: 'Explain the excerpt clearly: what it says, why it matters, and the meaning of each symbol or term.',
  simplify: 'Rewrite the excerpt in simple language a final-year undergraduate could follow. Keep it accurate.',
  expand: 'Expand on the excerpt: the background it assumes, the reasoning steps it skips, and how it connects to the rest of the topic.',
  summarize: 'Summarize the excerpt in at most 5 bullet points, keeping the key claims, conditions and results.',
  ask: 'Answer the user question using the excerpt.',
  critique: 'Critically assess the excerpt: assumptions, limitations, missing comparisons, and what evidence would be needed.',
  engineer: 'Explain the practical engineering meaning of the excerpt for RF/DSP/wireless design, with suggested experiments or simulations.',
};

export interface Grounding {
  /** selected text or card text; may be empty for figure-only questions */
  excerpt: string;
  /** nearby page text for context (truncated) */
  context?: string;
  title?: string;
  page?: number;
  hasImage?: boolean;
}

export function buildMessages(action: Action, role: Role, g: Grounding, question: string) {
  const roleSys = ROLES.find(r => r.id === role)!.system;
  const cite = g.title ? `"${g.title}"${g.page ? `, page ${g.page}` : ''}` : 'the provided material';
  const system = [
    roleSys,
    'Ground every statement in the provided excerpt, context or image. If something is not supported by them, say so explicitly and label it "(needs checking)".',
    'Never invent numerical values, equations, citations or results. Quote short phrases from the excerpt when you rely on them.',
    `When referring to the source, cite it as ${cite}.`,
    'Answer in English. Write equations in LaTeX.',
    'Be concise and structured: short paragraphs or bullet points.',
  ].join('\n');

  const parts: string[] = [`Task: ${TASK[action]}`];
  if (action === 'ask' || question.trim()) parts.push(`User question: ${question.trim() || '(none)'}`);
  parts.push(`Source: ${cite}`);
  if (g.excerpt.trim()) parts.push(`Excerpt:\n"""\n${g.excerpt.trim().slice(0, 6000)}\n"""`);
  if (g.hasImage) parts.push('An image of a figure/chart/equation from the source is attached. Describe only what is actually visible in it.');
  if (g.context?.trim()) parts.push(`Surrounding page text (for context only):\n"""\n${g.context.trim().slice(0, 3500)}\n"""`);
  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: parts.join('\n\n') },
  ];
}

/** Minimal, safe Markdown → React-friendly blocks (paragraphs, bullets, bold, inline code). */
export function toBlocks(md: string): { kind: 'p' | 'li' | 'h'; text: string }[] {
  return md
    .split('\n')
    .map(l => l.trimEnd())
    .filter(l => l.trim())
    .map(l => {
      const t = l.trim();
      if (/^#{1,4}\s/.test(t)) return { kind: 'h' as const, text: t.replace(/^#{1,4}\s/, '') };
      if (/^([-*•]|\d+[.)])\s/.test(t)) return { kind: 'li' as const, text: t.replace(/^([-*•]|\d+[.)])\s/, '') };
      return { kind: 'p' as const, text: t };
    });
}
