import { Note } from './types';

const DB_NAME = "decay_db";
const DB_VERSION = 1;
const STORE_NAME = "notes";

let dbInstance: IDBDatabase | null = null;

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      return resolve(dbInstance);
    }
    
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    
    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };
    
    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

export async function getAllNotes(): Promise<Note[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const notes = request.result as Note[];
      notes.sort((a, b) => b.lastVisitedAt - a.lastVisitedAt);
      resolve(notes);
    };
    
    request.onerror = () => reject(request.error);
  });
}

export async function getNoteById(id: string): Promise<Note | null> {
  const db = await initDB();
  const transaction = db.transaction(STORE_NAME, "readonly");
  const store = transaction.objectStore(STORE_NAME);
  const request = store.get(id);
  
  try {
    const result = await idbRequest<Note | undefined>(request);
    return result || null;
  } catch (error) {
    throw error;
  }
}

export async function saveNote(note: Note): Promise<void> {
  const db = await initDB();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  const request = store.put(note);
  
  await idbRequest(request);
}

export async function deleteNote(id: string): Promise<void> {
  const db = await initDB();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  const request = store.delete(id);
  
  await idbRequest(request);
}
