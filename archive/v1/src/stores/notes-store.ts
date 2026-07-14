import { create } from 'zustand';

interface NotesState {
  selectedNoteId: string | null;
  searchQuery: string;
  isCreating: boolean;
  setSelectedNote: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setIsCreating: (creating: boolean) => void;
}

export const useNotesStore = create<NotesState>((set) => ({
  selectedNoteId: null,
  searchQuery: '',
  isCreating: false,
  setSelectedNote: (id) => set({ selectedNoteId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setIsCreating: (creating) => set({ isCreating: creating }),
}));