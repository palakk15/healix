const databaseName = "healix-audio";
const storeName = "speech";
const memory = new Map<string, string[]>();

export async function cacheKey(text: string, language: string, pace: number): Promise<string> {
  const material = `${language}|${pace}|${text}`;
  try {
    const bytes = new TextEncoder().encode(material);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    let hash = 5381;
    for (let index = 0; index < material.length; index += 1) hash = ((hash << 5) + hash + material.charCodeAt(index)) | 0;
    return `h${hash >>> 0}-${material.length}`;
  }
}

function openDatabase(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(storeName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function readCachedAudio(key: string): Promise<string[] | null> {
  const fromMemory = memory.get(key);
  if (fromMemory) return fromMemory;
  try {
    const database = await openDatabase();
    if (!database) return null;
    return await new Promise<string[] | null>((resolve) => {
      try {
        const request = database.transaction(storeName, "readonly").objectStore(storeName).get(key);
        request.onsuccess = () => {
          const value: unknown = request.result;
          if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
            memory.set(key, value as string[]);
            resolve(value as string[]);
          } else resolve(null);
        };
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

export async function writeCachedAudio(key: string, audios: string[]): Promise<void> {
  memory.set(key, audios);
  try {
    const database = await openDatabase();
    if (!database) return;
    database.transaction(storeName, "readwrite").objectStore(storeName).put(audios, key);
  } catch {
    return;
  }
}

export function clearMemoryCacheForTests(): void {
  memory.clear();
}
