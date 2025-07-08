import { useState, useEffect } from 'react';
import { Save, Tag } from 'lucide-react';
import { useNote, useUpdateNote, useCreateNote } from '../../hooks/use-notes';
import { useNotesStore } from '../../stores/notes-store';
import { Button } from '../ui/Button';
import { formatDate } from '../../lib/utils';

export function NoteEditor() {
  const { selectedNoteId, isCreating, setIsCreating } = useNotesStore();
  const { data: note } = useNote(selectedNoteId);
  const updateNoteMutation = useUpdateNote();
  const createNoteMutation = useCreateNote();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    if (note && !isCreating) {
      setTitle(note.title);
      setContent(note.content);
      setTags(note.tags);
      setHasUnsavedChanges(false);
    } else if (isCreating) {
      setTitle('');
      setContent('');
      setTags([]);
      setHasUnsavedChanges(false);
    }
  }, [note, isCreating]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    setHasUnsavedChanges(true);
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    setHasUnsavedChanges(true);
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (!tags.includes(newTag)) {
        setTags([...tags, newTag]);
        setHasUnsavedChanges(true);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    if (isCreating) {
      createNoteMutation.mutate({
        title: title || 'Untitled',
        content,
        tags,
      });
    } else if (selectedNoteId) {
      updateNoteMutation.mutate({
        id: selectedNoteId,
        request: { title, content, tags },
      });
      setHasUnsavedChanges(false);
    }
  };

  const handleCancel = () => {
    if (isCreating) {
      setIsCreating(false);
    } else if (note) {
      setTitle(note.title);
      setContent(note.content);
      setTags(note.tags);
      setHasUnsavedChanges(false);
    }
  };

  const isSaving = createNoteMutation.isPending || updateNoteMutation.isPending;

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4 bg-card">
        <div className="flex items-center justify-between mb-4">
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Note title..."
            className="text-2xl font-bold bg-transparent border-none outline-none flex-1"
          />
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={isSaving || (!hasUnsavedChanges && !isCreating)}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {note && !isCreating && (
            <>
              <span>Created: {formatDate(note.created_at)}</span>
              <span>Updated: {formatDate(note.updated_at)}</span>
            </>
          )}
        </div>

        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="h-4 w-4" />
            <span className="text-sm font-medium">Tags</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="bg-secondary text-secondary-foreground px-2 py-1 rounded-xl text-sm cursor-pointer hover:bg-secondary/80"
                onClick={() => handleRemoveTag(tag)}
              >
                {tag} ×
              </span>
            ))}
          </div>
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            placeholder="Add a tag and press Enter..."
            className="w-full px-3 py-1 border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="flex-1 p-4">
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Start writing your note..."
          className="w-full h-full bg-transparent border-none outline-none resize-none text-base leading-relaxed"
        />
      </div>
    </div>
  );
}