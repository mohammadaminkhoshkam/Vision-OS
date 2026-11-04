// Speech input. Uses the Web Speech API when the runtime provides it (Chrome/Edge browser).
// WebView2 (the Tauri shell) usually does not, so the command bar remains the reliable path;
// a local speech engine can be plugged in later behind the same `listen()` call.
import { createStore } from '../lib/store';

type SR = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

const Ctor: (new () => SR) | undefined =
  (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition;

export const voiceState = createStore({
  supported: !!Ctor,
  listening: false,
  interim: '',
  error: null as string | null,
  lang: 'en-US',
});

let current: SR | null = null;

export function listen(onFinal: (text: string) => void) {
  if (!Ctor) {
    voiceState.set({ error: 'unsupported' });
    return;
  }
  stopListening();
  const rec = new Ctor();
  rec.lang = voiceState.get().lang;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  rec.continuous = false;
  rec.onresult = e => {
    let text = '';
    let final = false;
    for (let i = 0; i < e.results.length; i++) {
      text += e.results[i][0].transcript;
      final ||= e.results[i].isFinal;
    }
    voiceState.set({ interim: text });
    if (final) onFinal(text);
  };
  rec.onerror = e => voiceState.set({ error: e.error, listening: false });
  rec.onend = () => {
    voiceState.set({ listening: false });
    current = null;
  };
  current = rec;
  voiceState.set({ listening: true, interim: '', error: null });
  try {
    rec.start();
  } catch (e) {
    voiceState.set({ listening: false, error: String(e) });
  }
}

export function stopListening() {
  current?.stop();
  current = null;
  voiceState.set({ listening: false });
}
