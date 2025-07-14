# Refactoring Documentation: Unified Note Editor Component

**Branch Name:** `refactor/unified-note-editor`  
**Date:** 2025-07-14  
**Status:** Planning

## Table of Contents
1. [Problem Statement](#problem-statement)
2. [Analysis of Duplicated Code](#analysis-of-duplicated-code)
3. [Proposed Solution](#proposed-solution)
4. [Implementation Plan](#implementation-plan)
5. [Benefits](#benefits)
6. [Risk Mitigation](#risk-mitigation)
7. [Testing Strategy](#testing-strategy)

## Problem Statement

The Blink application currently has significant code duplication between the main window editor (`EditorArea.tsx`) and detached window editor (`DetachedNoteWindow.tsx`). This duplication creates several issues:

- **~150 lines of duplicated code** between the two components
- **Maintenance burden** - features must be implemented twice
- **Risk of inconsistent behavior** - easy to forget to update both places
- **Recent example** - vim mode indicator was missing in detached windows until manually added

## Analysis of Duplicated Code

### Shared Functionality (Currently Duplicated)

1. **Editor Integration**
   - CodeMirrorEditor component usage with identical configuration
   - MarkdownRenderer for preview mode
   - Preview/Edit mode toggle logic
   - Content change handling

2. **Vim Mode Support**
   - Vim status tracking (`{ mode: string; subMode?: string }`)
   - Visual indicators (color-coded for INSERT/VISUAL/NORMAL)
   - Mode change callbacks

3. **Styling and Configuration**
   - Paper style class generation (`getPaperStyleClass` function)
   - Editor configuration (fontSize, fontFamily, lineHeight)
   - Background patterns
   - Typewriter mode support

4. **UI Elements**
   - Save status indicators
   - Word count display
   - Footer/status bar patterns

### Key Differences to Preserve

**EditorArea.tsx (Main Window)**
- Receives props from parent components
- Uses `textareaRef` for additional functionality
- Elaborate mode toggle with sliding pill animation
- Shows "Select a note to start editing" empty state
- Integrated into larger layout system

**DetachedNoteWindow.tsx (Standalone Window)**
- Self-contained with own data fetching
- Window-specific features (close, keyboard shortcuts)
- Custom window chrome (CustomTitleBar, WindowWrapper)
- Compact mode toggle for title bar
- Window shading support
- Loading and error states

## Proposed Solution

### New Component: `NoteEditor`

Create a new component that encapsulates the shared editor functionality while allowing parent components to maintain their unique features.

#### Component Location
`/src/components/editor/NoteEditor.tsx`

#### Interface Design

```typescript
interface EditorConfig {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  editorFontFamily?: string;
  previewFontFamily?: string;
  contentFontSize?: number;
  syntaxHighlighting?: boolean;
  vimMode?: boolean;
  typewriterMode?: boolean;
  backgroundPattern?: string;
  notePaperStyle?: string;
}

interface VimStatus {
  mode: string;
  subMode?: string;
}

interface NoteEditorProps {
  // Content
  content: string;
  onContentChange: (content: string) => void;
  
  // Preview mode
  isPreviewMode: boolean;
  onPreviewToggle?: () => void;
  
  // Configuration
  config: EditorConfig;
  
  // Vim mode
  vimStatus?: VimStatus;
  onVimStatusChange?: (status: VimStatus) => void;
  
  // Optional props
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  
  // Render props for custom UI elements
  renderModeToggle?: () => React.ReactNode;
  renderFooter?: () => React.ReactNode;
}
```

#### Component Structure

```typescript
export function NoteEditor({
  content,
  onContentChange,
  isPreviewMode,
  onPreviewToggle,
  config,
  vimStatus,
  onVimStatusChange,
  placeholder = "Start writing...",
  autoFocus = false,
  className = "",
  textareaRef,
  renderModeToggle,
  renderFooter
}: NoteEditorProps) {
  // Shared paper style logic
  const paperStyleClass = getPaperStyleClass(config.notePaperStyle);
  
  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Optional custom mode toggle */}
      {renderModeToggle && renderModeToggle()}
      
      {/* Editor/Preview area */}
      <div className={`flex-1 relative overflow-hidden ${
        config.backgroundPattern && config.backgroundPattern !== 'none' 
          ? `bg-pattern-${config.backgroundPattern}` 
          : ''
      } ${paperStyleClass}`}>
        {!isPreviewMode ? (
          <CodeMirrorEditor
            value={content}
            onChange={onContentChange}
            placeholder={placeholder}
            vimMode={config.vimMode || false}
            fontSize={config.fontSize}
            fontFamily={config.editorFontFamily || config.fontFamily}
            lineHeight={config.lineHeight}
            typewriterMode={config.typewriterMode || false}
            autoFocus={autoFocus}
            className={paperStyleClass}
            onVimStatusChange={onVimStatusChange}
            textareaRef={textareaRef}
          />
        ) : (
          <MarkdownRenderer
            content={content}
            syntaxHighlighting={config.syntaxHighlighting}
            className={`w-full h-full overflow-y-auto prose prose-invert max-w-none cursor-text ${paperStyleClass}`}
            onDoubleClick={onPreviewToggle}
            title="Double-click to edit"
            style={{ 
              fontSize: `${config.contentFontSize || config.fontSize}px`,
              fontFamily: config.previewFontFamily || 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
              lineHeight: config.lineHeight,
              padding: '1.5rem'
            }}
          />
        )}
      </div>
      
      {/* Optional custom footer */}
      {renderFooter && renderFooter()}
    </div>
  );
}
```

## Implementation Plan

### Phase 1: Create Core Component
1. Create `/src/components/editor/NoteEditor.tsx`
2. Move shared paper style utility function
3. Implement the core editor/preview logic
4. Add proper TypeScript types

### Phase 2: Refactor EditorArea
1. Import `NoteEditor`
2. Replace duplicated editor logic with the new component
3. Use render props for custom mode toggle UI
4. Preserve all existing functionality

### Phase 3: Refactor DetachedNoteWindow
1. Import `NoteEditor`
2. Replace duplicated editor logic
3. Use render props for window-specific UI
4. Ensure vim mode and save debouncing still work

### Phase 4: Cleanup
1. Remove all duplicated code
2. Update imports and exports
3. Run type checking
4. Test both windows thoroughly

## Benefits

1. **Code Reduction** - Eliminate ~150 lines of duplicated code
2. **Single Source of Truth** - Editor behavior defined in one place
3. **Easier Maintenance** - Features only need to be implemented once
4. **Consistent Behavior** - Guaranteed same functionality in both contexts
5. **Better Testing** - Can unit test the core editor logic separately
6. **Future Flexibility** - Easy to add new editor contexts if needed

## Risk Mitigation

### Preserving Unique Features
- Use render props pattern to allow custom UI elements
- Keep window-specific logic in parent components
- Maintain separate configuration handling where needed

### Handling Edge Cases
- Ensure `textareaRef` still works for EditorArea
- Preserve keyboard shortcut handling in DetachedNoteWindow
- Maintain proper focus management

### Rollback Strategy
- Work on feature branch
- Keep old code commented during transition
- Comprehensive testing before removing old code
- Git history allows easy revert if needed

## Testing Strategy

### Manual Testing Checklist
- [ ] Main window editor loads and displays content
- [ ] Detached window editor loads and displays content
- [ ] Preview mode toggle works in both contexts
- [ ] Vim mode indicators appear correctly
- [ ] Save status works properly (with debouncing)
- [ ] Keyboard shortcuts still function
- [ ] Window-specific features preserved
- [ ] Configuration changes apply correctly
- [ ] No visual regressions

### Automated Testing Opportunities
- Unit tests for `NoteEditor`
- Integration tests for parent components
- Visual regression tests if available

## Success Criteria

The refactoring is successful when:
1. Both editors use the same core component
2. No duplicated editor logic remains
3. All existing features work identically
4. Code is cleaner and more maintainable
5. No user-visible changes or regressions

## Future Enhancements

This refactoring enables:
- Easier addition of new editor features
- Potential for editor presets or themes
- Better performance optimizations
- Simplified testing infrastructure