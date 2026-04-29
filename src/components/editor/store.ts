import { create } from 'zustand';

interface EditorState {
  isDrawMode: boolean;
  isFocusMode: boolean;
  toggleDrawMode: () => void;
  toggleFocusMode: () => void;
  setDrawMode: (active: boolean) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  isDrawMode: false,
  isFocusMode: false,
  toggleDrawMode: () => set((state) => ({ isDrawMode: !state.isDrawMode })),
  toggleFocusMode: () => set((state) => ({ isFocusMode: !state.isFocusMode })),
  setDrawMode: (active) => set({ isDrawMode: active }),
}));
