import { useEffect, useRef, useState } from 'react';
import { EditorView, keymap, ViewUpdate, placeholder, drawSelection } from '@codemirror/view';
import { EditorState, Extension, Compartment } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, indentWithTab, history, historyKeymap } from '@codemirror/commands';
import { vim, getCM } from '@replit/codemirror-vim';
import { listen } from '@tauri-apps/api/event';
import { readText } from '@tauri-apps/plugin-clipboard-manager';

interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  onVimStatusChange?: (status: { mode: string; subMode?: string }) => void;
  placeholder?: string;
  vimMode?: boolean;
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
  className?: string;
  readOnly?: boolean;
  autoFocus?: boolean;
  typewriterMode?: boolean;
  wordWrap?: boolean;
}

export function CodeMirrorEditor({
  value,
  onChange,
  onSave,
  onVimStatusChange,
  placeholder: placeholderText = 'Start typing...',
  vimMode = false,
  fontSize = 15,
  fontFamily = 'system-ui',
  lineHeight = 1.6,
  className = '',
  readOnly = false,
  autoFocus = false,
  typewriterMode = false,
  wordWrap = true,
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
        backgroundColor: 'hsl(var(--background))',
      },
      '.cm-content': {
        padding: '20px',
        lineHeight: `${lineHeight}`,
        caretColor: 'var(--cursor-insert)', // Green for insert mode by default
        backgroundColor: 'transparent',
      },
      '.cm-focused': {
        outline: 'none',
      },
      '.cm-editor': {
        height: '100%',
        outline: 'none',
        backgroundColor: 'hsl(var(--card) / 0.3)',
        borderRadius: '0',
        '--editor-font-size': `${fontSize}px`,
        '--editor-line-height': `${lineHeight}`,
      },
      '.cm-editor.cm-focused': {
        outline: 'none',
        backgroundColor: 'hsl(var(--card) / 0.4)',
      },
      '.cm-scroller': {
        fontFamily: fontFamily,
        fontSize: `${fontSize}px`,
        lineHeight: `${lineHeight}`,
        backgroundColor: 'transparent',
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
      // Cursor styling handled by CSS - ensure base visibility
      '.cm-cursor, .cm-cursor-primary': {
        visibility: 'visible !important',
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
      configCompartment.current.of(createTheme()),
      markdown(),
      history(), // Add history support for undo/redo
      drawSelection(), // Add explicit selection drawing
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap, // Add history keybindings (Cmd-Z, Cmd-Shift-Z)
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
      
      // Prevent delete key in Normal mode and handle paste
      extensions.push(
        keymap.of([
          {
            key: 'Delete',
            run: (view) => {
              const cm = getCM(view);
              if (cm && cm.state.vim && !cm.state.vim.insertMode) {
                // In Normal/Visual mode, don't allow delete key
                return true; // Consume the event, do nothing
              }
              return false; // Let it pass through in Insert mode
            }
          },
        ])
      );
      
      // Track vim mode changes
      if (onVimStatusChange) {
        extensions.push(
          EditorView.updateListener.of((update: ViewUpdate) => {
            if (update.view.hasFocus) {
              const cm = getCM(update.view);
              if (cm) {
                const vimState = cm.state.vim;
                if (vimState) {
                  const mode = vimState.insertMode ? 'INSERT' : 
                               vimState.visualMode ? 'VISUAL' : 
                               'NORMAL';
                  onVimStatusChange({ mode, subMode: vimState.status });
                  
                  // Update editor classes based on vim mode
                  const editorDom = update.view.dom;
                  editorDom.classList.remove('cm-vim-insert-mode', 'cm-vim-visual-mode', 'cm-vim-normal-mode', 'cm-vim-visual-line');
                  
                  if (vimState.insertMode) {
                    editorDom.classList.add('cm-vim-insert-mode');
                    console.log('[BLINK] Vim mode: INSERT');
                  } else if (vimState.visualMode) {
                    editorDom.classList.add('cm-vim-visual-mode');
                    if (vimState.visualLine) {
                      editorDom.classList.add('cm-vim-visual-line');
                    }
                    console.log('[BLINK] Vim mode: VISUAL', vimState.visualLine ? '(LINE)' : '');
                    
                    // Debug: Check selection state
                    const selection = update.view.state.selection;
                    console.log('[BLINK] Selection:', {
                      main: selection.main,
                      from: selection.main.from,
                      to: selection.main.to,
                      empty: selection.main.empty
                    });
                    
                    // Force selection if in visual mode
                    const cm = getCM(update.view);
                    if (cm && cm.state.vim) {
                      const vimSel = cm.state.vim.sel;
                      if (vimSel && vimSel.anchor && vimSel.head) {
                        console.log('[BLINK] Vim selection:', vimSel);
                        
                        // Calculate the actual selection positions
                        const from = Math.min(vimSel.anchor.ch, vimSel.head.ch);
                        const to = Math.max(vimSel.anchor.ch, vimSel.head.ch) + 1; // +1 because vim includes the character
                        const line = vimSel.anchor.line || 0;
                        
                        // Get the document position
                        const docLine = update.view.state.doc.line(line + 1); // Lines are 1-indexed
                        const fromPos = docLine.from + from;
                        const toPos = docLine.from + to;
                        
                        // Create a selection if it doesn't match
                        if (selection.main.from !== fromPos || selection.main.to !== toPos) {
                          console.log('[BLINK] Creating selection:', { fromPos, toPos });
                          update.view.dispatch({
                            selection: { anchor: fromPos, head: toPos }
                          });
                        }
                      }
                    }
                  } else {
                    editorDom.classList.add('cm-vim-normal-mode');
                    console.log('[BLINK] Vim mode: NORMAL');
                  }
                }
              }
            }
          })
        );
      }
    }

    // Add typewriter mode class
    if (typewriterMode) {
      extensions.push(
        EditorView.contentAttributes.of({
          class: 'typewriter-mode',
        })
      );
    }

    // Add word wrap extension
    if (wordWrap) {
      extensions.push(EditorView.lineWrapping);
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

  // Set up paste listener separately so it persists
  useEffect(() => {
    const unlistenPromise = listen('menu-paste', async () => {
      console.log('[BLINK] Menu paste event received in editor');
      try {
        const text = await readText();
        console.log('[BLINK] Clipboard text:', text?.substring(0, 50) + '...');
        
        if (text && viewRef.current) {
          const view = viewRef.current;
          const cm = getCM(view);
          
          // If in vim normal mode, switch to insert mode first
          if (cm && cm.state.vim && !cm.state.vim.insertMode) {
            // Enter insert mode at cursor position
            view.dispatch({
              changes: {
                from: view.state.selection.main.head,
                insert: text
              }
            });
          } else {
            // In insert mode or non-vim mode, just insert at selection
            view.dispatch({
              changes: {
                from: view.state.selection.main.from,
                to: view.state.selection.main.to,
                insert: text
              }
            });
          }
          console.log('[BLINK] Text pasted successfully');
        } else {
          console.error('[BLINK] No text or view available');
        }
      } catch (err) {
        console.error('[BLINK] Failed to paste:', err);
      }
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten());
    };
  }, []); // Set up once on mount


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
      effects: configCompartment.current.reconfigure(createTheme()),
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
        '--cursor-normal': '#3b82f6',
        '--cursor-insert': '#10b981',
        '--cursor-visual': '#8b5cf6',
        '--cursor-command': '#f59e0b',
      } as React.CSSProperties}
    />
  );
}