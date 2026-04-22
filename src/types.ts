export type NoteStatus = 'alive' | 'ghost' | 'gone';

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  lastVisitedAt: number;
  decayRate: number;
  opacity: number;
  status: NoteStatus;
  recallAttempts: number;
  tags: string[];
}

export interface OpacityResult {
  opacity: number;
  status: NoteStatus;
}

export interface RecallResult {
  success: boolean;
  score: number;
  userText: string;
}

export interface ReconstructResult {
  reconstructed: boolean;
  newContent: string;
}

export interface ScoreResponse {
  score: number;
  feedback: string;
}

export interface ReconstructScoreResponse {
  score: number;
  feedback: string;
  preservedConcepts: string[];
}
