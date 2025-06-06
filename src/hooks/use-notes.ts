import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notesApi } from '../services/tauri-api';
import { CreateNoteRequest, UpdateNoteRequest } from '../types/note';
import { useNotesStore } from '../stores/notes-store';

export function useNotes() {
  return useQuery({
    queryKey: ['notes'],
    queryFn: notesApi.getNotes,
  });
}

export function useNote(id: string | null) {
  return useQuery({
    queryKey: ['note', id],
    queryFn: () => (id ? notesApi.getNote(id) : null),
    enabled: !!id,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  const { setSelectedNote, setIsCreating } = useNotesStore();

  return useMutation({
    mutationFn: notesApi.createNote,
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      setSelectedNote(note.id);
      setIsCreating(false);
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: UpdateNoteRequest }) =>
      notesApi.updateNote(id, request),
    onSuccess: (note) => {
      if (note) {
        queryClient.invalidateQueries({ queryKey: ['notes'] });
        queryClient.invalidateQueries({ queryKey: ['note', note.id] });
      }
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  const { setSelectedNote } = useNotesStore();

  return useMutation({
    mutationFn: notesApi.deleteNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      setSelectedNote(null);
    },
  });
}