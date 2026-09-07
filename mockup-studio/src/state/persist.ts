import type { Project } from "@/state/project";

// A tiny IndexedDB key/value store. Holds the project JSON under "project",
// each source video/image blob under "media:<mediaId>", and the background
// image under "bg". Persistence is best-effort — if IndexedDB is unavailable
// (private mode, quota) every call degrades to a no-op rather than crashing.

const DB_NAME = "mockup-studio";
const STORE = "kv";
let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function idbSet(key: string, value: unknown): Promise<void> {
  return db().then(
    (d) =>
      new Promise((resolve, reject) => {
        const t = d.transaction(STORE, "readwrite");
        t.objectStore(STORE).put(value, key);
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
      }),
  );
}

function idbGet<T>(key: string): Promise<T | undefined> {
  return db().then(
    (d) =>
      new Promise((resolve, reject) => {
        const t = d.transaction(STORE, "readonly");
        const r = t.objectStore(STORE).get(key);
        r.onsuccess = () => resolve(r.result as T | undefined);
        r.onerror = () => reject(r.error);
      }),
  );
}

function idbDelete(key: string): Promise<void> {
  return db().then(
    (d) =>
      new Promise((resolve, reject) => {
        const t = d.transaction(STORE, "readwrite");
        t.objectStore(STORE).delete(key);
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
      }),
  );
}

function idbKeys(): Promise<string[]> {
  return db().then(
    (d) =>
      new Promise((resolve, reject) => {
        const t = d.transaction(STORE, "readonly");
        const r = t.objectStore(STORE).getAllKeys();
        r.onsuccess = () => resolve(r.result.map(String));
        r.onerror = () => reject(r.error);
      }),
  );
}

function idbClear(): Promise<void> {
  return db().then(
    (d) =>
      new Promise((resolve, reject) => {
        const t = d.transaction(STORE, "readwrite");
        t.objectStore(STORE).clear();
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
      }),
  );
}

export async function persistProject(project: Project): Promise<void> {
  try {
    await idbSet("project", project);
  } catch {
    /* best-effort */
  }
}

export async function persistMediaBlob(mediaId: string, blob: Blob): Promise<void> {
  try {
    await idbSet(`media:${mediaId}`, blob);
  } catch {
    /* best-effort */
  }
}

export async function persistBgBlob(blob: Blob): Promise<void> {
  try {
    await idbSet("bg", blob);
  } catch {
    /* best-effort */
  }
}

export async function loadProject(): Promise<Project | null> {
  try {
    return (await idbGet<Project>("project")) ?? null;
  } catch {
    return null;
  }
}

export async function loadMediaBlob(mediaId: string): Promise<Blob | null> {
  try {
    return (await idbGet<Blob>(`media:${mediaId}`)) ?? null;
  } catch {
    return null;
  }
}

export async function loadBgBlob(): Promise<Blob | null> {
  try {
    return (await idbGet<Blob>("bg")) ?? null;
  } catch {
    return null;
  }
}

/** Delete the whole saved session. */
export async function clearPersisted(): Promise<void> {
  try {
    await idbClear();
  } catch {
    /* best-effort */
  }
}

/** Drop stored media blobs whose mediaId is no longer used by any clip. */
export async function pruneMedia(validMediaIds: string[]): Promise<void> {
  try {
    const keep = new Set(validMediaIds.map((m) => `media:${m}`));
    const keys = await idbKeys();
    await Promise.all(
      keys.filter((k) => k.startsWith("media:") && !keep.has(k)).map((k) => idbDelete(k)),
    );
  } catch {
    /* best-effort */
  }
}
