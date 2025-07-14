import { FileText, Plus } from 'lucide-react';
import { Button } from '../ui/Button';
import { useNotesStore } from '../../stores/notes-store';

export function EmptyState() {
  const { setIsCreating } = useNotesStore();

  const handleCreateNote = () => {
    setIsCreating(true);
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-6">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-semibold mb-2">No note selected</h2>
        <p className="text-muted-foreground mb-6">
          Select a note from the sidebar or create a new one to get started.
        </p>
        <Button onClick={handleCreateNote}>
          <Plus className="h-4 w-4 mr-2" />
          Create New Note
        </Button>
      </div>
    </div>
  );
}