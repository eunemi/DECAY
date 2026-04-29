import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { DecayWorkspace } from './DecayWorkspace';
import { Note } from '../../types';

let currentRoot: Root | null = null;

export function mountDecayWorkspace(container: HTMLElement, note: Note, onSave: (note: Note) => void, onClose: () => void) {
  if (currentRoot) {
    currentRoot.unmount();
  }
  currentRoot = createRoot(container);
  currentRoot.render(<DecayWorkspace note={note} onSave={onSave} onClose={onClose} />);
}

export function unmountDecayWorkspace() {
  if (currentRoot) {
    currentRoot.unmount();
    currentRoot = null;
  }
}
