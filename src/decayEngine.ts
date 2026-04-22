import { Note, OpacityResult } from './types';
import { getAllNotes, saveNote, getNoteById } from './db';

// per minute. At this rate, note fully decays in ~7 days (10080 minutes)
export const DEFAULT_DECAY_RATE = 0.0001;

// floor — decay never goes below this even after many recalls
export const MIN_DECAY_RATE = 0.000001;

// each successful recall halves the decay rate
export const RECALL_DECAY_MULTIPLIER = 0.5;

export async function createNote(title: string, content: string, tags: string[]): Promise<Note> {
  const id = crypto.randomUUID();
  const note: Note = {
    id,
    title,
    content,
    tags,
    createdAt: Date.now(),
    lastVisitedAt: Date.now(),
    decayRate: DEFAULT_DECAY_RATE,
    opacity: 1.0,
    status: 'alive',
    recallAttempts: 0
  };
  
  await saveNote(note);
  return note;
}

export function calculateCurrentOpacity(note: Note): OpacityResult {
  const minutesElapsed = (Date.now() - note.lastVisitedAt) / 60000;
  const rawOpacity = note.opacity - (note.decayRate * minutesElapsed);
  const opacity = Math.max(0, rawOpacity);
  
  if (opacity <= 0 && note.status === 'alive') {
    return { opacity: 0, status: 'ghost' };
  }
  
  if (note.status === 'ghost') {
    return { opacity: 0, status: 'ghost' };
  }
  
  return { opacity, status: note.status };
}

export async function visitNote(id: string): Promise<Note | null> {
  const note = await getNoteById(id);
  if (!note) return null;
  
  const updatedNote: Note = {
    ...note,
    lastVisitedAt: Date.now(),
    opacity: 1.0,
    status: 'alive'
  };
  
  await saveNote(updatedNote);
  return updatedNote;
}

export async function syncAllDecay(): Promise<void> {
  const notes = await getAllNotes();
  
  for (const note of notes) {
    if (note.status !== 'gone') {
      const result = calculateCurrentOpacity(note);
      if (result.opacity !== note.opacity || result.status !== note.status) {
        await saveNote({
          ...note,
          opacity: result.opacity,
          status: result.status
        });
      }
    }
  }
}

export async function recallSuccess(id: string): Promise<Note | null> {
  const note = await getNoteById(id);
  if (!note) return null;
  
  const updatedNote: Note = {
    ...note,
    recallAttempts: note.recallAttempts + 1,
    lastVisitedAt: Date.now(),
    decayRate: Math.max(MIN_DECAY_RATE, note.decayRate * RECALL_DECAY_MULTIPLIER),
    opacity: 1.0,
    status: 'alive'
  };
  
  await saveNote(updatedNote);
  return updatedNote;
}

export async function updateNoteContent(id: string, title: string, content: string): Promise<Note | null> {
  const note = await getNoteById(id);
  if (!note) return null;
  
  const updatedNote: Note = {
    ...note,
    title,
    content,
    lastVisitedAt: Date.now(),
    opacity: 1.0,
    status: 'alive'
  };
  
  await saveNote(updatedNote);
  return updatedNote;
}
