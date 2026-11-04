import { addNode, link } from '../board/model';
import type { Source } from '../board/model';
import { board, commit } from '../board/store';
import { createStore, loadJson, saveJson } from '../lib/store';
import { toast } from '../state/app';
import { isVisionModel, ollama, type ChatMessage, type OllamaModel } from './ollama';
import { buildMessages, type Action, type Role } from './prompts';

const KEY = 'vos.ai';

interface Settings {
  model: string;
  role: Role;
  temperature: number;
}

export interface AskContext {
  excerpt: string;
  context?: string;
  image?: string; // data URL
  source: Source;
  fromNode?: string;
}

const settings = loadJson<Settings>(KEY, { model: '', role: 'teacher', temperature: 0.3 });

export const ai = createStore({
  settings,
  status: { checked: false, ok: false, version: '', models: [] as OllamaModel[], error: '' },
  open: false,
  ctx: null as AskContext | null,
  action: 'explain' as Action,
  question: '',
  answer: '',
  running: false,
  error: '',
  usedModel: '',
  pulling: null as null | { model: string; status: string; frac: number | null },
});

export function setAiSettings(patch: Partial<Settings>) {
  ai.set(s => ({ settings: { ...s.settings, ...patch } }));
  saveJson(KEY, ai.get().settings);
}

export async function checkStatus() {
  const st = await ollama.status();
  ai.set({ status: { checked: true, ok: st.ok, version: st.version ?? '', models: st.models, error: st.error ?? '' } });
  // pick a sensible default model once one exists
  const cur = ai.get().settings.model;
  if (st.ok && st.models.length && !st.models.some(m => m.name === cur)) {
    const pref = st.models.find(m => m.name.startsWith('gemma3')) ?? st.models.find(m => isVisionModel(m)) ?? st.models[0];
    setAiSettings({ model: pref.name });
  }
  return st.ok;
}

let controller: AbortController | null = null;

export function openAssistant(ctx: AskContext, action?: Action, autoRun = false) {
  ai.set({ open: true, ctx, answer: '', error: '', question: '', ...(action ? { action } : {}) });
  void checkStatus().then(ok => {
    if (ok && autoRun) void runAssistant();
  });
}

export function closeAssistant() {
  cancelAssistant();
  ai.set({ open: false });
}

export function cancelAssistant() {
  controller?.abort();
  controller = null;
  ai.set({ running: false });
}

export async function runAssistant() {
  const s = ai.get();
  if (!s.ctx || s.running) return;
  const model = s.settings.model;
  if (!s.status.ok) return ai.set({ error: 'Ollama is not available' });
  if (!model) return ai.set({ error: 'Install and select a model first' });
  const src = s.ctx.source;
  const hasImage = !!s.ctx.image && isVisionModel(model);
  const messages: ChatMessage[] = buildMessages(
    s.action,
    s.settings.role,
    { excerpt: s.ctx.excerpt, context: s.ctx.context, title: src && 'title' in src ? src.title : undefined, page: src?.kind === 'pdf' ? src.page : undefined, hasImage },
    s.question,
  );
  if (hasImage) messages[1] = { ...messages[1], images: [s.ctx.image!.replace(/^data:image\/\w+;base64,/, '')] };
  controller = new AbortController();
  ai.set({ running: true, answer: '', error: '', usedModel: model });
  try {
    await ollama.chat(model, messages, t => ai.set(st => ({ answer: st.answer + t })), controller.signal, s.settings.temperature);
  } catch (e) {
    if (!(e instanceof DOMException && e.name === 'AbortError')) ai.set({ error: e instanceof Error ? e.message : String(e) });
  } finally {
    ai.set({ running: false });
    controller = null;
  }
}

/** Keep the answer on the knowledge board with its provenance, linked to the card it came from. */
export function answerToBoard() {
  const s = ai.get();
  if (!s.answer.trim() || !s.ctx) return;
  const { doc, view } = board.get();
  const from = s.ctx.fromNode ? doc.nodes.find(n => n.id === s.ctx!.fromNode) : undefined;
  const pos = from ? { x: from.x + from.w + 60, y: from.y } : { x: (innerWidth * 0.3 - view.x) / view.scale, y: (innerHeight * 0.4 - view.y) / view.scale };
  const id = Math.random().toString(36).slice(2, 10);
  const footer = `\n\n— ${s.usedModel} · ${new Date().toLocaleDateString('en-US')} · Local model answer; check before citing`;
  let next = addNode(doc, { id, type: 'ai', w: 320, text: s.answer.trim() + footer, source: s.ctx.source, ...pos });
  if (from) next = link(next, from.id, id, 'AI');
  commit(next);
  toast('Answer sent to the knowledge board', 'ok');
}

export async function pullModel(model: string) {
  ai.set({ pulling: { model, status: 'Starting…', frac: null } });
  try {
    await ollama.pull(model, (status, frac) => ai.set({ pulling: { model, status, frac } }));
    toast(`Model ${model} installed`, 'ok');
    setAiSettings({ model });
    await checkStatus();
  } catch (e) {
    toast(`Model install failed: ${e instanceof Error ? e.message : e}`, 'warn');
  } finally {
    ai.set({ pulling: null });
  }
}
