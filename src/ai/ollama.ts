// Local AI through Ollama (SR-04..08). Everything stays on this computer: in the desktop shell
// requests go through the Rust bridge, in the browser through Vite's /ollama proxy.
import { Channel, invoke } from '@tauri-apps/api/core';
import { isTauri } from '../platform';

export interface OllamaModel {
  name: string;
  size: number;
  details?: { family?: string; parameter_size?: string; families?: string[] };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  /** base64 images (no data: prefix) for vision models */
  images?: string[];
}

async function getJson<T>(path: string): Promise<T> {
  if (isTauri) return JSON.parse(await invoke<string>('ollama_get', { path })) as T;
  const r = await fetch(`/ollama${path}`);
  if (!r.ok) throw new Error(`Ollama ${r.status}`);
  return r.json() as Promise<T>;
}

/** POST with an NDJSON streamed response; calls onLine for every JSON object. */
async function streamJson(path: string, body: unknown, onLine: (obj: Record<string, unknown>) => void, signal?: AbortSignal) {
  let buffer = '';
  let failure: unknown = null; // errors inside a Tauri channel callback must be rethrown here
  const emit = (line: string) => {
    try {
      onLine(JSON.parse(line));
    } catch (e) {
      failure ??= e;
    }
  };
  const feed = (text: string) => {
    buffer += text;
    let i: number;
    while ((i = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, i).trim();
      buffer = buffer.slice(i + 1);
      if (line) emit(line);
    }
  };
  if (isTauri) {
    const id = Math.random().toString(36).slice(2);
    const ch = new Channel<string>();
    ch.onmessage = feed;
    signal?.addEventListener('abort', () => void invoke('ollama_cancel', { id }));
    await invoke('ollama_stream', { path, body: JSON.stringify(body), id, onChunk: ch });
  } else {
    const r = await fetch(`/ollama${path}`, { method: 'POST', body: JSON.stringify(body), signal, headers: { 'Content-Type': 'application/json' } });
    if (!r.ok || !r.body) throw new Error(`Ollama ${r.status}: ${await r.text()}`);
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      feed(dec.decode(value, { stream: true }));
    }
  }
  if (buffer.trim()) emit(buffer.trim());
  if (failure) throw failure;
}

export const ollama = {
  async status(): Promise<{ ok: boolean; version?: string; models: OllamaModel[]; error?: string }> {
    try {
      const [v, t] = await Promise.all([getJson<{ version: string }>('/api/version'), getJson<{ models: OllamaModel[] }>('/api/tags')]);
      return { ok: true, version: v.version, models: t.models ?? [] };
    } catch (e) {
      return { ok: false, models: [], error: e instanceof Error ? e.message : String(e) };
    }
  },

  /** Streams the reply; returns the full text. */
  async chat(model: string, messages: ChatMessage[], onToken: (t: string) => void, signal?: AbortSignal, temperature = 0.3): Promise<string> {
    let full = '';
    await streamJson(
      '/api/chat',
      { model, messages, stream: true, options: { temperature, num_ctx: 8192 } },
      obj => {
        if (obj.error) throw new Error(String(obj.error));
        const piece = (obj.message as { content?: string } | undefined)?.content ?? '';
        if (piece) {
          full += piece;
          onToken(piece);
        }
      },
      signal,
    );
    return full;
  },

  /** Downloads a model (user-initiated). Progress 0..1 when sizes are known. */
  async pull(model: string, onProgress: (status: string, frac: number | null) => void, signal?: AbortSignal) {
    await streamJson(
      '/api/pull',
      { model, stream: true },
      obj => {
        if (obj.error) throw new Error(String(obj.error));
        const total = Number(obj.total ?? 0), done = Number(obj.completed ?? 0);
        onProgress(String(obj.status ?? ''), total ? done / total : null);
      },
      signal,
    );
  },
};

/** Models known to accept images in Ollama (used for figure explanations). */
export const isVisionModel = (m: OllamaModel | string) => {
  const name = typeof m === 'string' ? m : m.name;
  const fam = typeof m === 'string' ? [] : (m.details?.families ?? []);
  return /gemma3|llava|vision|qwen2\.5vl|qwen2-vl|minicpm-v|moondream|bakllava|granite3\.2-vision|mistral-small3/.test(name) || fam.includes('clip');
};

export const RECOMMENDED = [
  { name: 'gemma3:4b', size: '3.3 GB', note: 'First choice: text + images (explains charts); fits fully on a 6 GB card' },
  { name: 'qwen2.5:7b', size: '4.7 GB', note: 'Stronger text, no images' },
  { name: 'gemma3:12b', size: '8.1 GB', note: 'Better quality but slower (partly runs on the CPU)' },
];
