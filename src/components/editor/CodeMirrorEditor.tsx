import { useEffect, useRef, useState } from 'react';
import { EditorView, keymap, ViewUpdate, placeholder } from '@codemirror/view';
import { EditorState, Extension, Compartment } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { vim } from '@replit/codemirror-vim';
import { oneDark } from '@codemirror/theme-one-dark';

interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  placeholder?: string;
  vimMode?: boolean;
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
  className?: string;
  readOnly?: boolean;
  autoFocus?: boolean;
  typewriterMode?: boolean;
}

export function CodeMirrorEditor({
  value,
  onChange,
  onSave,
  placeholder: placeholderText = 'Start typing...',
  vimMode = false,
  fontSize = 15,
  fontFamily = 'system-ui',
  lineHeight = 1.6,
  className = '',
  readOnly = false,
  autoFocus = false,
  typewriterMode = false,
}: CodeMirrorEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [isVimActive, setIsVimActive] = useState(vimMode);
  const configCompartment = useRef(new Compartment());

  // Create the editor theme with minimal UI
  const createTheme = () => {
    return EditorView.theme({
      '&': {
        height: '100%',
        fontSize: `${fontSize}px`,
        fontFamily: fontFamily,
      },
      '.cm-content': {
        padding: '20px',
        lineHeight: `${lineHeight}`,
        caretColor: 'var(--primary)',
      },
      '.cm-focused': {
        outline: 'none',
      },
      '.cm-editor': {
        height: '100%',
      },
      '.cm-editor.cm-focused': {
        outline: 'none',
      },
      '.cm-scroller': {
        fontFamily: fontFamily,
        fontSize: `${fontSize}px`,
        lineHeight: `${lineHeight}`,
      },
      '.cm-placeholder': {
        color: 'var(--muted-foreground)',
        opacity: 0.4,
      },
      // Hide gutters (line numbers)
      '.cm-gutters': {
        display: 'none',
      },
      // Typewriter mode
      '.cm-content.typewriter-mode': {
        paddingTop: '50vh',
        paddingBottom: '50vh',
      },
      // Selection styling
      '.cm-selectionBackground': {
        backgroundColor: 'var(--primary)' + '30',
      },
      '.cm-focused .cm-selectionBackground': {
        backgroundColor: 'var(--primary)' + '40',
      },
      // Cursor styling
      '.cm-cursor': {
        borderLeftColor: 'var(--primary)',
        borderLeftWidth: '2px',
      },
      // Search highlights
      '.cm-searchMatch': {
        backgroundColor: 'var(--primary)' + '30',
        outline: '1px solid ' + 'var(--primary)' + '50',
      },
      '.cm-searchMatch.cm-searchMatch-selected': {
        backgroundColor: 'var(--primary)' + '60',
      },
    });
  };

  // Create extensions array
  const createExtensions = (): Extension[] => {
    const extensions: Extension[] = [
      configCompartment.current.of([
        createTheme(),
        oneDark,
      ]),
      markdown(),
      keymap.of([
        ...defaultKeymap,
        indentWithTab,
        {
          key: 'Cmd-s',
          run: () => {
            onSave?.();
            return true;
          },
        },
      ]),
      EditorView.updateListener.of((update: ViewUpdate) => {
        if (update.docChanged) {
          const newValue = update.state.doc.toString();
          onChange(newValue);
        }
      }),
      EditorView.contentAttributes.of({
        'aria-label': 'Note editor',
        'aria-multiline': 'true',
        'role': 'textbox',
      }),
      EditorState.readOnly.of(readOnly),
    ];

    // Add placeholder extension if provided
    if (placeholderText) {
      extensions.push(
        placeholder(placeholderText)
      );
    }

    // Add vim mode if enabled
    if (isVimActive) {
      extensions.push(vim());
      extensions.push(
        EditorView.editorAttributes.of({
          class: 'cm-vim-mode'
        })
      );
    }

    // Add typewriter mode class
    if (typewriterMode) {
      extensions.push(
        EditorView.contentAttributes.of({
          class: 'typewriter-mode',
        })
      );
    }

    return extensions;
  };

  // Initialize editor
  useEffect(() => {
    if (!editorRef.current || viewRef.current) return;

    const startState = EditorState.create({
      doc: value,
      extensions: createExtensions(),
    });

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    viewRef.current = view;

    if (autoFocus) {
      view.focus();
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []); // Only run once on mount


  // Update content when value prop changes (external updates)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentValue = view.state.doc.toString();
    if (currentValue !== value) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value,
        },
      });
    }
  }, [value]);

  // Update vim mode
  useEffect(() => {
    setIsVimActive(vimMode);
    const view = viewRef.current;
    if (!view) return;

    // Recreate the entire state with new extensions
    const newState = EditorState.create({
      doc: view.state.doc,
      extensions: createExtensions(),
    });
    view.setState(newState);
  }, [vimMode]);

  // Update theme when appearance settings change
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: configCompartment.current.reconfigure([
        createTheme(),
        oneDark,
      ]),
    });
  }, [fontSize, fontFamily, lineHeight, typewriterMode]);

  // Handle typewriter mode scrolling
  useEffect(() => {
    if (!typewriterMode || !viewRef.current) return;

    const view = viewRef.current;
    const scrollToCursor = () => {
      const head = view.state.selection.main.head;
      const coords = view.coordsAtPos(head);
      if (coords) {
        const scroller = view.scrollDOM;
        const scrollerRect = scroller.getBoundingClientRect();
        const targetY = scrollerRect.height / 2;
        const currentY = coords.top - scrollerRect.top;
        const scrollTop = scroller.scrollTop + (currentY - targetY);
        
        scroller.scrollTo({
          top: scrollTop,
          behavior: 'smooth',
        });
      }
    };

    const updateListener = EditorView.updateListener.of((update: ViewUpdate) => {
      if (update.selectionSet || update.docChanged) {
        requestAnimationFrame(scrollToCursor);
      }
    });

    // Re-create state with typewriter mode extension
    const currentExtensions = createExtensions();
    const newState = EditorState.create({
      doc: view.state.doc,
      extensions: [...currentExtensions, updateListener],
    });
    view.setState(newState);
  }, [typewriterMode]);

  return (
    <div 
      ref={editorRef} 
      className={`h-full w-full overflow-hidden ${className}`}
      style={{
        '--primary': 'hsl(var(--primary))',
        '--background': 'hsl(var(--background))',
        '--foreground': 'hsl(var(--foreground))',
        '--muted-foreground': 'hsl(var(--muted-foreground))',
        '--border': 'hsl(var(--border))',
      } as React.CSSProperties}
    />
  );
}