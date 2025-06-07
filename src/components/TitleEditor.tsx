import { useState, useEffect, useRef } from 'react';

interface TitleEditorProps {
  title: string;
  onTitleChange: (title: string) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

export function TitleEditor({ 
  title, 
  onTitleChange, 
  className = "", 
  placeholder = "Untitled",
  autoFocus = false
}: TitleEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(title);
  }, [title]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditValue(title);
  };

  const handleSaveEdit = () => {
    const finalTitle = editValue.trim() || placeholder;
    onTitleChange(finalTitle);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditValue(title);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  const displayTitle = title.trim() || placeholder;

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSaveEdit}
        onKeyDown={handleKeyDown}
        className={`bg-transparent border-none outline-none ${className}`}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
    );
  }

  return (
    <span
      onClick={handleStartEdit}
      className={`cursor-text hover:bg-white/5 px-1 -mx-1 rounded transition-colors ${className} ${
        !title.trim() ? 'text-muted-foreground/60 italic' : ''
      }`}
      title="Click to edit title"
    >
      {displayTitle}
    </span>
  );
}