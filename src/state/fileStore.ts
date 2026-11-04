// Local PDFs opened from disk are kept in IndexedDB (on this computer only) so «continue where you
// left off» and saved research spaces still work after a restart. The store is bounded: the most
// recently used files are kept until a count or size budget is reached.

export interface StoredMeta {
  id: string;
  name: string;
  size: number;
  at: number;
}

export const MAX_FILES = 8;
export const MAX_BYTES = 250 * 1024 * 1024;

/** Ids to evict: oldest first, until both budgets hold. A single file over budget is not kept. */
export function evictions(entries: StoredMeta[], maxFiles = MAX_FILES, maxBytes = MAX_BYTES): string[] {
  const sorted = [...entries].sort((a, b) => b.at - a.at);
  const out: string[] = [];
  let bytes = 0, count = 0;
  for (const e of sorted) {
    if (count < maxFiles && bytes + e.size <= maxBytes) {
      count++;
      bytes += e.size;
    } else out.push(e.id);
  }
  return out;
}

const DB = 'vision-os', STORE = 'files';

function db(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | null> {
  return db().then(
    d =>
      new Promise(resolve => {
        if (!d) return resolve(null);
        try {
          const t = d.transaction(STORE, mode);
          const r = run(t.objectStore(STORE));
          t.oncomplete = () => resolve(r ? (r.result as T) : null);
          t.onerror = t.onabort = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

export async function storeFileDoc(id: string, name: string, data: ArrayBuffer) {
  if (data.byteLength > MAX_BYTES) return;
  await tx('readwrite', s => s.put({ id, name, size: data.byteLength, at: Date.now(), data: data.slice(0) }));
  const all = (await tx<StoredMeta[]>('readonly', s => s.getAll())) ?? [];
  const drop = evictions(all.map(({ id, name, size, at }) => ({ id, name, size, at })));
  if (drop.length) await tx('readwrite', s => void drop.forEach(k => s.delete(k)));
}

export async function loadFileDoc(id: string): Promise<{ name: string; data: ArrayBuffer } | null> {
  const row = await tx<{ id: string; name: string; data: ArrayBuffer; size: number; at: number }>('readonly', s => s.get(id));
  if (!row) return null;
  void tx('readwrite', s => s.put({ ...row, at: Date.now() }));
  return { name: row.name, data: row.data };
}
